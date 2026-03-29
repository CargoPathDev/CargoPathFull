from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from bson import ObjectId
import secrets
import stripe

# Initialize Stripe with secret key from environment
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'cargo_paths_db')]

# JWT Configuration
JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ.get("JWT_SECRET", "default-secret-change-me")

# Password utilities
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

# Create the main app
app = FastAPI(title="CargoPaths API")

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/api/auth")

# Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    subscription_tier: str = "free"
    created_at: datetime

class VehicleCreate(BaseModel):
    name: str
    vehicle_type: str  # car, lorry, van, bus, etc.
    height_meters: float
    width_meters: float
    weight_kg: float
    license_plate: Optional[str] = None

class VehicleResponse(BaseModel):
    id: str
    user_id: str
    name: str
    vehicle_type: str
    height_meters: float
    width_meters: float
    weight_kg: float
    license_plate: Optional[str] = None
    is_active: bool = False
    created_at: datetime

class RoadAlertCreate(BaseModel):
    alert_type: str  # speed_camera, roadwork, hazard, school_zone, bump, traffic_light, police_visible, police_hidden, police_trap, police_checkpoint
    latitude: float
    longitude: float
    description: Optional[str] = None
    speed_limit: Optional[int] = None
    time_restriction_start: Optional[str] = None
    time_restriction_end: Optional[str] = None
    diversion_info: Optional[str] = None
    estimated_end_date: Optional[str] = None

# Road Worker Models
class RoadWorkCreate(BaseModel):
    work_type: str  # road_closure, lane_closure, temp_traffic_lights, resurfacing, utilities, construction
    latitude: float
    longitude: float
    end_latitude: Optional[float] = None
    end_longitude: Optional[float] = None
    description: str
    company_name: str
    start_date: str
    estimated_end_date: str
    diversion_route: Optional[str] = None
    affected_lanes: Optional[str] = None
    working_hours: Optional[str] = None  # e.g., "08:00-18:00"
    contact_phone: Optional[str] = None

class RoadWorkResponse(BaseModel):
    id: str
    work_type: str
    latitude: float
    longitude: float
    end_latitude: Optional[float] = None
    end_longitude: Optional[float] = None
    description: str
    company_name: str
    start_date: str
    estimated_end_date: str
    diversion_route: Optional[str] = None
    affected_lanes: Optional[str] = None
    working_hours: Optional[str] = None
    contact_phone: Optional[str] = None
    status: str  # pending, approved, active, completed
    created_by: str
    created_at: datetime
    verified: bool = False

class RoadAlertResponse(BaseModel):
    id: str
    alert_type: str
    latitude: float
    longitude: float
    description: Optional[str] = None
    speed_limit: Optional[int] = None
    time_restriction_start: Optional[str] = None
    time_restriction_end: Optional[str] = None
    diversion_info: Optional[str] = None
    estimated_end_date: Optional[str] = None
    created_by: str
    created_at: datetime
    upvotes: int = 0
    is_active: bool = True

class RoadRestrictionCreate(BaseModel):
    restriction_type: str  # height, weight, width
    latitude: float
    longitude: float
    limit_value: float
    description: Optional[str] = None

class RoadRestrictionResponse(BaseModel):
    id: str
    restriction_type: str
    latitude: float
    longitude: float
    limit_value: float
    description: Optional[str] = None
    is_active: bool = True

class SubscriptionUpdate(BaseModel):
    tier: str  # free, basic, premium, corporate

class PricingUpdate(BaseModel):
    basic_monthly: float
    basic_yearly: float
    premium_monthly: float
    premium_yearly: float
    corporate_monthly: float
    corporate_yearly: float
    yearly_discount_percent: int
    trial_days: int = 30

class GiftSubscription(BaseModel):
    user_email: str
    tier: str
    duration_months: int = 12  # How long the gift lasts
    reason: Optional[str] = None  # e.g., "Family member"

# Points System Models
class PointTransaction(BaseModel):
    action: str  # report_alert, confirm_alert, report_verified
    points: int
    description: Optional[str] = None

class RewardItem(BaseModel):
    id: str
    name: str
    type: str  # avatar, voice, badge
    cost: int
    image_url: Optional[str] = None

class PurchaseReward(BaseModel):
    reward_id: str

# Corporate Models
class CorporateAccountCreate(BaseModel):
    company_name: str
    admin_email: str
    max_vehicles: int = 100
    safety_mode_enabled: bool = True

class EmployeeAssignment(BaseModel):
    employee_email: str
    vehicle_id: Optional[str] = None

# Settings Models
class UserSettings(BaseModel):
    theme: str = "auto"  # light, dark, auto
    dark_mode_start: str = "19:00"
    dark_mode_end: str = "06:00"
    voice_id: str = "default"
    sound_mode: str = "full"  # off, alerts, full
    speed_unit: str = "mph"  # mph, kmh
    distance_unit: str = "miles"  # miles, km
    safety_reminder_enabled: bool = True
    avatar_id: str = "default"

# Auth helper
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Auth endpoints
@auth_router.post("/register")
async def register(user_data: UserCreate, response: Response):
    email = user_data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Get trial settings
    settings = await db.app_settings.find_one({"type": "pricing"})
    trial_days = settings.get("trial_days", 30) if settings else 30
    
    user_doc = {
        "email": email,
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "subscription_tier": "premium",  # Start with premium trial
        "is_trial": True,
        "trial_start": datetime.now(timezone.utc),
        "trial_days": trial_days,
        "is_gifted": False,
        "gifted_by": None,
        "gift_reason": None,
        "gift_expires": None,
        "role": "user",
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {
        "id": user_id,
        "email": email,
        "name": user_data.name,
        "subscription_tier": "premium",
        "is_trial": True,
        "trial_days_remaining": trial_days,
        "access_token": access_token
    }

@auth_router.post("/login")
async def login(credentials: UserLogin, response: Response):
    email = credentials.email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {
        "id": user_id,
        "email": user["email"],
        "name": user["name"],
        "subscription_tier": user.get("subscription_tier", "free"),
        "access_token": access_token
    }

@auth_router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {"message": "Logged out successfully"}

@auth_router.get("/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return {
        "id": user["_id"],
        "email": user["email"],
        "name": user["name"],
        "subscription_tier": user.get("subscription_tier", "free")
    }

# Vehicle endpoints
@api_router.get("/vehicles", response_model=List[VehicleResponse])
async def get_vehicles(request: Request):
    user = await get_current_user(request)
    vehicles = await db.vehicles.find({"user_id": user["_id"]}).to_list(100)
    return [
        VehicleResponse(
            id=str(v["_id"]),
            user_id=v["user_id"],
            name=v["name"],
            vehicle_type=v["vehicle_type"],
            height_meters=v["height_meters"],
            width_meters=v["width_meters"],
            weight_kg=v["weight_kg"],
            license_plate=v.get("license_plate"),
            is_active=v.get("is_active", False),
            created_at=v["created_at"]
        ) for v in vehicles
    ]

@api_router.post("/vehicles", response_model=VehicleResponse)
async def create_vehicle(vehicle: VehicleCreate, request: Request):
    user = await get_current_user(request)
    
    # Check vehicle limits based on subscription
    vehicle_count = await db.vehicles.count_documents({"user_id": user["_id"]})
    tier = user.get("subscription_tier", "free")
    limits = {"free": 2, "basic": 5, "premium": 10}
    max_vehicles = limits.get(tier, 2)
    
    if vehicle_count >= max_vehicles:
        raise HTTPException(
            status_code=403,
            detail=f"Vehicle limit reached. {tier.title()} plan allows {max_vehicles} vehicles. Upgrade to add more."
        )
    
    vehicle_doc = {
        "user_id": user["_id"],
        "name": vehicle.name,
        "vehicle_type": vehicle.vehicle_type,
        "height_meters": vehicle.height_meters,
        "width_meters": vehicle.width_meters,
        "weight_kg": vehicle.weight_kg,
        "license_plate": vehicle.license_plate,
        "is_active": vehicle_count == 0,  # First vehicle is active by default
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.vehicles.insert_one(vehicle_doc)
    
    return VehicleResponse(
        id=str(result.inserted_id),
        user_id=user["_id"],
        name=vehicle.name,
        vehicle_type=vehicle.vehicle_type,
        height_meters=vehicle.height_meters,
        width_meters=vehicle.width_meters,
        weight_kg=vehicle.weight_kg,
        license_plate=vehicle.license_plate,
        is_active=vehicle_count == 0,
        created_at=vehicle_doc["created_at"]
    )

@api_router.put("/vehicles/{vehicle_id}/activate")
async def activate_vehicle(vehicle_id: str, request: Request):
    user = await get_current_user(request)
    
    # Deactivate all vehicles
    await db.vehicles.update_many(
        {"user_id": user["_id"]},
        {"$set": {"is_active": False}}
    )
    
    # Activate selected vehicle
    result = await db.vehicles.update_one(
        {"_id": ObjectId(vehicle_id), "user_id": user["_id"]},
        {"$set": {"is_active": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    return {"message": "Vehicle activated successfully"}

@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.vehicles.delete_one(
        {"_id": ObjectId(vehicle_id), "user_id": user["_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"message": "Vehicle deleted successfully"}

@api_router.get("/vehicles/active", response_model=Optional[VehicleResponse])
async def get_active_vehicle(request: Request):
    user = await get_current_user(request)
    vehicle = await db.vehicles.find_one({"user_id": user["_id"], "is_active": True})
    if not vehicle:
        return None
    return VehicleResponse(
        id=str(vehicle["_id"]),
        user_id=vehicle["user_id"],
        name=vehicle["name"],
        vehicle_type=vehicle["vehicle_type"],
        height_meters=vehicle["height_meters"],
        width_meters=vehicle["width_meters"],
        weight_kg=vehicle["weight_kg"],
        license_plate=vehicle.get("license_plate"),
        is_active=vehicle.get("is_active", False),
        created_at=vehicle["created_at"]
    )

# Road Alerts endpoints
@api_router.get("/alerts", response_model=List[RoadAlertResponse])
async def get_alerts(lat: Optional[float] = None, lng: Optional[float] = None, radius_km: float = 10):
    query = {"is_active": True}
    alerts = await db.road_alerts.find(query).to_list(500)
    return [
        RoadAlertResponse(
            id=str(a["_id"]),
            alert_type=a["alert_type"],
            latitude=a["latitude"],
            longitude=a["longitude"],
            description=a.get("description"),
            speed_limit=a.get("speed_limit"),
            time_restriction_start=a.get("time_restriction_start"),
            time_restriction_end=a.get("time_restriction_end"),
            diversion_info=a.get("diversion_info"),
            estimated_end_date=a.get("estimated_end_date"),
            created_by=a["created_by"],
            created_at=a["created_at"],
            upvotes=a.get("upvotes", 0),
            is_active=a.get("is_active", True)
        ) for a in alerts
    ]

@api_router.post("/alerts", response_model=RoadAlertResponse)
async def create_alert(alert: RoadAlertCreate, request: Request):
    user = await get_current_user(request)
    
    alert_doc = {
        "alert_type": alert.alert_type,
        "latitude": alert.latitude,
        "longitude": alert.longitude,
        "description": alert.description,
        "speed_limit": alert.speed_limit,
        "time_restriction_start": alert.time_restriction_start,
        "time_restriction_end": alert.time_restriction_end,
        "diversion_info": alert.diversion_info,
        "estimated_end_date": alert.estimated_end_date,
        "created_by": user["_id"],
        "created_at": datetime.now(timezone.utc),
        "upvotes": 0,
        "is_active": True
    }
    result = await db.road_alerts.insert_one(alert_doc)
    
    return RoadAlertResponse(
        id=str(result.inserted_id),
        **{k: v for k, v in alert_doc.items() if k != "_id"}
    )

@api_router.post("/alerts/{alert_id}/upvote")
async def upvote_alert(alert_id: str, request: Request):
    await get_current_user(request)
    result = await db.road_alerts.update_one(
        {"_id": ObjectId(alert_id)},
        {"$inc": {"upvotes": 1}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"message": "Alert upvoted"}

# Road Restrictions (mock data for demonstration)
@api_router.get("/restrictions", response_model=List[RoadRestrictionResponse])
async def get_restrictions(lat: Optional[float] = None, lng: Optional[float] = None, radius_km: float = 10):
    restrictions = await db.road_restrictions.find({"is_active": True}).to_list(500)
    return [
        RoadRestrictionResponse(
            id=str(r["_id"]),
            restriction_type=r["restriction_type"],
            latitude=r["latitude"],
            longitude=r["longitude"],
            limit_value=r["limit_value"],
            description=r.get("description"),
            is_active=r.get("is_active", True)
        ) for r in restrictions
    ]

@api_router.post("/restrictions", response_model=RoadRestrictionResponse)
async def create_restriction(restriction: RoadRestrictionCreate, request: Request):
    user = await get_current_user(request)
    
    restriction_doc = {
        "restriction_type": restriction.restriction_type,
        "latitude": restriction.latitude,
        "longitude": restriction.longitude,
        "limit_value": restriction.limit_value,
        "description": restriction.description,
        "created_by": user["_id"],
        "created_at": datetime.now(timezone.utc),
        "is_active": True
    }
    result = await db.road_restrictions.insert_one(restriction_doc)
    
    return RoadRestrictionResponse(
        id=str(result.inserted_id),
        **{k: v for k, v in restriction_doc.items() if k not in ["_id", "created_by", "created_at"]}
    )

# Subscription endpoints
@api_router.get("/subscription")
async def get_subscription(request: Request):
    user = await get_current_user(request)
    tier = user.get("subscription_tier", "free")
    vehicle_count = await db.vehicles.count_documents({"user_id": user["_id"]})
    limits = {"free": 2, "basic": 5, "premium": 10}
    
    # Get pricing info
    settings = await db.app_settings.find_one({"type": "pricing"})
    
    # Calculate trial status
    trial_info = None
    if user.get("is_trial"):
        trial_start = user.get("trial_start")
        if trial_start:
            if isinstance(trial_start, str):
                trial_start = datetime.fromisoformat(trial_start.replace("Z", "+00:00"))
            trial_days = user.get("trial_days", 30)
            trial_end = trial_start + timedelta(days=trial_days)
            now = datetime.now(timezone.utc)
            days_remaining = (trial_end - now).days
            trial_info = {
                "is_trial": True,
                "days_remaining": max(0, days_remaining),
                "trial_expired": days_remaining <= 0
            }
            
            # If trial expired, downgrade to free
            if days_remaining <= 0:
                await db.users.update_one(
                    {"_id": ObjectId(user["_id"])},
                    {"$set": {"subscription_tier": "free", "is_trial": False}}
                )
                tier = "free"
    
    # Check gift status
    gift_info = None
    if user.get("is_gifted"):
        gift_expires = user.get("gift_expires")
        if gift_expires:
            if isinstance(gift_expires, str):
                gift_expires = datetime.fromisoformat(gift_expires.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            if gift_expires < now:
                # Gift expired, downgrade
                await db.users.update_one(
                    {"_id": ObjectId(user["_id"])},
                    {"$set": {"subscription_tier": "free", "is_gifted": False}}
                )
                tier = "free"
            else:
                gift_info = {
                    "is_gifted": True,
                    "gifted_by": user.get("gifted_by"),
                    "reason": user.get("gift_reason"),
                    "expires": gift_expires.isoformat()
                }
    
    return {
        "tier": tier,
        "vehicle_count": vehicle_count,
        "vehicle_limit": limits.get(tier, 2),
        "features": {
            "free": ["2 vehicles", "Basic navigation", "Community alerts"],
            "basic": ["5 vehicles", "Advanced navigation", "Priority alerts", "Route optimization"],
            "premium": ["10 vehicles", "All features", "Fuel-efficient routes", "Road worker portal"]
        }.get(tier, []),
        "trial": trial_info,
        "gift": gift_info,
        "pricing": {
            "basic_monthly": settings.get("basic_monthly", 4.99) if settings else 4.99,
            "basic_yearly": settings.get("basic_yearly", 47.88) if settings else 47.88,
            "premium_monthly": settings.get("premium_monthly", 9.99) if settings else 9.99,
            "premium_yearly": settings.get("premium_yearly", 95.88) if settings else 95.88,
            "yearly_discount_percent": settings.get("yearly_discount_percent", 20) if settings else 20
        }
    }

@api_router.post("/subscription/upgrade")
async def upgrade_subscription(subscription: SubscriptionUpdate, request: Request):
    user = await get_current_user(request)
    
    if subscription.tier not in ["free", "basic", "premium"]:
        raise HTTPException(status_code=400, detail="Invalid subscription tier")
    
    # In production, this would integrate with Stripe
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"subscription_tier": subscription.tier}}
    )
    
    return {"message": f"Subscription upgraded to {subscription.tier}", "tier": subscription.tier}

# Road Worker Portal endpoints
@api_router.get("/roadworks", response_model=List[RoadWorkResponse])
async def get_roadworks(status: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": ["approved", "active"]}
    
    roadworks = await db.roadworks.find(query).to_list(500)
    return [
        RoadWorkResponse(
            id=str(rw["_id"]),
            work_type=rw["work_type"],
            latitude=rw["latitude"],
            longitude=rw["longitude"],
            end_latitude=rw.get("end_latitude"),
            end_longitude=rw.get("end_longitude"),
            description=rw["description"],
            company_name=rw["company_name"],
            start_date=rw["start_date"],
            estimated_end_date=rw["estimated_end_date"],
            diversion_route=rw.get("diversion_route"),
            affected_lanes=rw.get("affected_lanes"),
            working_hours=rw.get("working_hours"),
            contact_phone=rw.get("contact_phone"),
            status=rw["status"],
            created_by=rw["created_by"],
            created_at=rw["created_at"],
            verified=rw.get("verified", False)
        ) for rw in roadworks
    ]

@api_router.post("/roadworks", response_model=RoadWorkResponse)
async def create_roadwork(roadwork: RoadWorkCreate, request: Request):
    user = await get_current_user(request)
    
    roadwork_doc = {
        "work_type": roadwork.work_type,
        "latitude": roadwork.latitude,
        "longitude": roadwork.longitude,
        "end_latitude": roadwork.end_latitude,
        "end_longitude": roadwork.end_longitude,
        "description": roadwork.description,
        "company_name": roadwork.company_name,
        "start_date": roadwork.start_date,
        "estimated_end_date": roadwork.estimated_end_date,
        "diversion_route": roadwork.diversion_route,
        "affected_lanes": roadwork.affected_lanes,
        "working_hours": roadwork.working_hours,
        "contact_phone": roadwork.contact_phone,
        "status": "pending",  # Requires approval
        "created_by": user["_id"],
        "created_at": datetime.now(timezone.utc),
        "verified": False
    }
    result = await db.roadworks.insert_one(roadwork_doc)
    
    return RoadWorkResponse(
        id=str(result.inserted_id),
        **{k: v for k, v in roadwork_doc.items() if k != "_id"}
    )

@api_router.put("/roadworks/{roadwork_id}/approve")
async def approve_roadwork(roadwork_id: str, request: Request):
    user = await get_current_user(request)
    
    # Only admin can approve
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can approve roadworks")
    
    result = await db.roadworks.update_one(
        {"_id": ObjectId(roadwork_id)},
        {"$set": {"status": "approved", "verified": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Roadwork not found")
    
    return {"message": "Roadwork approved"}

@api_router.put("/roadworks/{roadwork_id}/status")
async def update_roadwork_status(roadwork_id: str, status: str, request: Request):
    user = await get_current_user(request)
    
    if status not in ["pending", "approved", "active", "completed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    # Check if user owns this roadwork or is admin
    roadwork = await db.roadworks.find_one({"_id": ObjectId(roadwork_id)})
    if not roadwork:
        raise HTTPException(status_code=404, detail="Roadwork not found")
    
    if roadwork["created_by"] != user["_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.roadworks.update_one(
        {"_id": ObjectId(roadwork_id)},
        {"$set": {"status": status}}
    )
    
    return {"message": f"Roadwork status updated to {status}"}

@api_router.delete("/roadworks/{roadwork_id}")
async def delete_roadwork(roadwork_id: str, request: Request):
    user = await get_current_user(request)
    
    roadwork = await db.roadworks.find_one({"_id": ObjectId(roadwork_id)})
    if not roadwork:
        raise HTTPException(status_code=404, detail="Roadwork not found")
    
    if roadwork["created_by"] != user["_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.roadworks.delete_one({"_id": ObjectId(roadwork_id)})
    
    return {"message": "Roadwork deleted"}

# ==================== ADMIN PANEL ENDPOINTS ====================

# Admin: Get pricing settings
@api_router.get("/admin/pricing")
async def get_pricing(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.app_settings.find_one({"type": "pricing"})
    if not settings:
        # Default pricing
        settings = {
            "type": "pricing",
            "basic_monthly": 4.99,
            "basic_yearly": 47.88,  # ~20% discount
            "premium_monthly": 9.99,
            "premium_yearly": 95.88,  # ~20% discount
            "yearly_discount_percent": 20,
            "trial_days": 30,
            "currency": "GBP",
            "currency_symbol": "£"
        }
        await db.app_settings.insert_one(settings)
    
    settings.pop("_id", None)
    return settings

# Admin: Update pricing
@api_router.put("/admin/pricing")
async def update_pricing(pricing: PricingUpdate, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.app_settings.update_one(
        {"type": "pricing"},
        {"$set": {
            "basic_monthly": pricing.basic_monthly,
            "basic_yearly": pricing.basic_yearly,
            "premium_monthly": pricing.premium_monthly,
            "premium_yearly": pricing.premium_yearly,
            "yearly_discount_percent": pricing.yearly_discount_percent,
            "trial_days": pricing.trial_days,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    return {"message": "Pricing updated successfully"}

# Admin: Get all users
@api_router.get("/admin/users")
async def get_all_users(request: Request, skip: int = 0, limit: int = 50):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find().skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents({})
    
    # Calculate trial status for each user
    now = datetime.now(timezone.utc)
    user_list = []
    for u in users:
        user_data = {
            "id": str(u["_id"]),
            "email": u["email"],
            "name": u["name"],
            "subscription_tier": u.get("subscription_tier", "free"),
            "is_trial": u.get("is_trial", False),
            "is_gifted": u.get("is_gifted", False),
            "gifted_by": u.get("gifted_by"),
            "gift_reason": u.get("gift_reason"),
            "role": u.get("role", "user"),
            "created_at": u.get("created_at")
        }
        
        # Calculate trial days remaining
        if u.get("is_trial") and u.get("trial_start"):
            trial_start = u["trial_start"]
            if isinstance(trial_start, str):
                trial_start = datetime.fromisoformat(trial_start.replace("Z", "+00:00"))
            trial_days = u.get("trial_days", 30)
            trial_end = trial_start + timedelta(days=trial_days)
            days_remaining = (trial_end - now).days
            user_data["trial_days_remaining"] = max(0, days_remaining)
            user_data["trial_expired"] = days_remaining <= 0
        
        # Check gift expiration
        if u.get("is_gifted") and u.get("gift_expires"):
            gift_expires = u["gift_expires"]
            if isinstance(gift_expires, str):
                gift_expires = datetime.fromisoformat(gift_expires.replace("Z", "+00:00"))
            user_data["gift_expired"] = gift_expires < now
        
        user_list.append(user_data)
    
    return {"users": user_list, "total": total}

# Admin: Gift subscription to a user
@api_router.post("/admin/gift-subscription")
async def gift_subscription(gift: GiftSubscription, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Find the target user
    target_user = await db.users.find_one({"email": gift.user_email.lower()})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found with that email")
    
    if gift.tier not in ["basic", "premium"]:
        raise HTTPException(status_code=400, detail="Can only gift basic or premium tiers")
    
    # Calculate gift expiration
    gift_expires = datetime.now(timezone.utc) + timedelta(days=gift.duration_months * 30)
    
    # Update user
    await db.users.update_one(
        {"_id": target_user["_id"]},
        {"$set": {
            "subscription_tier": gift.tier,
            "is_trial": False,
            "is_gifted": True,
            "gifted_by": user["email"],
            "gift_reason": gift.reason,
            "gift_expires": gift_expires,
            "gift_duration_months": gift.duration_months
        }}
    )
    
    return {
        "message": f"Successfully gifted {gift.tier} subscription to {gift.user_email}",
        "expires": gift_expires.isoformat()
    }

# Admin: Revoke gift/subscription
@api_router.post("/admin/revoke-subscription/{user_id}")
async def revoke_subscription(user_id: str, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "subscription_tier": "free",
            "is_trial": False,
            "is_gifted": False,
            "gifted_by": None,
            "gift_reason": None,
            "gift_expires": None
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Subscription revoked, user set to free tier"}

# Admin: Dashboard stats
@api_router.get("/admin/stats")
async def get_admin_stats(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_users = await db.users.count_documents({})
    free_users = await db.users.count_documents({"subscription_tier": "free"})
    basic_users = await db.users.count_documents({"subscription_tier": "basic"})
    premium_users = await db.users.count_documents({"subscription_tier": "premium"})
    trial_users = await db.users.count_documents({"is_trial": True})
    gifted_users = await db.users.count_documents({"is_gifted": True})
    total_vehicles = await db.vehicles.count_documents({})
    total_alerts = await db.road_alerts.count_documents({})
    total_roadworks = await db.roadworks.count_documents({})
    
    return {
        "total_users": total_users,
        "subscriptions": {
            "free": free_users,
            "basic": basic_users,
            "premium": premium_users
        },
        "trial_users": trial_users,
        "gifted_users": gifted_users,
        "total_vehicles": total_vehicles,
        "total_alerts": total_alerts,
        "total_roadworks": total_roadworks
    }

# Public: Get pricing for display
@api_router.get("/pricing")
async def get_public_pricing():
    settings = await db.app_settings.find_one({"type": "pricing"})
    if not settings:
        settings = {
            "basic_monthly": 4.99,
            "basic_yearly": 47.88,
            "premium_monthly": 9.99,
            "premium_yearly": 95.88,
            "corporate_monthly": 49.99,
            "corporate_yearly": 479.88,
            "yearly_discount_percent": 20,
            "trial_days": 30,
            "currency": "GBP",
            "currency_symbol": "£"
        }
    
    return {
        "basic": {
            "monthly": settings.get("basic_monthly", 4.99),
            "yearly": settings.get("basic_yearly", 47.88),
        },
        "premium": {
            "monthly": settings.get("premium_monthly", 9.99),
            "yearly": settings.get("premium_yearly", 95.88),
        },
        "corporate": {
            "monthly": settings.get("corporate_monthly", 49.99),
            "yearly": settings.get("corporate_yearly", 479.88),
        },
        "yearly_discount_percent": settings.get("yearly_discount_percent", 20),
        "trial_days": settings.get("trial_days", 30),
        "currency": settings.get("currency", "GBP"),
        "currency_symbol": settings.get("currency_symbol", "£")
    }

# ==================== POINTS & REWARDS SYSTEM ====================

POINT_VALUES = {
    "report_alert": 10,
    "confirm_alert": 3,
    "report_verified": 5,
    "first_report_day": 2,
    "streak_bonus": 5
}

@api_router.get("/points")
async def get_user_points(request: Request):
    user = await get_current_user(request)
    user_points = await db.user_points.find_one({"user_id": user["_id"]})
    
    if not user_points:
        user_points = {
            "user_id": user["_id"],
            "total_points": 0,
            "lifetime_points": 0,
            "level": 1,
            "streak_days": 0,
            "last_activity": None
        }
        await db.user_points.insert_one(user_points)
    
    # Calculate level (every 100 points = 1 level)
    level = (user_points.get("lifetime_points", 0) // 100) + 1
    
    return {
        "total_points": user_points.get("total_points", 0),
        "lifetime_points": user_points.get("lifetime_points", 0),
        "level": level,
        "streak_days": user_points.get("streak_days", 0),
        "next_level_points": level * 100
    }

@api_router.post("/points/earn")
async def earn_points(transaction: PointTransaction, request: Request):
    user = await get_current_user(request)
    
    points = POINT_VALUES.get(transaction.action, transaction.points)
    
    # Update user points
    result = await db.user_points.update_one(
        {"user_id": user["_id"]},
        {
            "$inc": {"total_points": points, "lifetime_points": points},
            "$set": {"last_activity": datetime.now(timezone.utc)}
        },
        upsert=True
    )
    
    # Log transaction
    await db.point_transactions.insert_one({
        "user_id": user["_id"],
        "action": transaction.action,
        "points": points,
        "description": transaction.description,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"message": f"Earned {points} points", "points_earned": points}

@api_router.get("/points/history")
async def get_points_history(request: Request, limit: int = 20):
    user = await get_current_user(request)
    
    transactions = await db.point_transactions.find(
        {"user_id": user["_id"]}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return [{
        "action": t["action"],
        "points": t["points"],
        "description": t.get("description"),
        "created_at": t["created_at"]
    } for t in transactions]

# Rewards Store
@api_router.get("/rewards")
async def get_rewards():
    rewards = await db.rewards.find({"is_active": True}).to_list(100)
    
    if not rewards:
        # Seed default rewards
        default_rewards = [
            # Avatars
            {"name": "Crown Car", "type": "avatar", "cost": 50, "icon": "car-sport", "color": "#FFD700", "is_active": True},
            {"name": "Racing Car", "type": "avatar", "cost": 100, "icon": "car-sport", "color": "#FF6B6B", "is_active": True},
            {"name": "Monster Truck", "type": "avatar", "cost": 200, "icon": "car-sport", "color": "#9B59B6", "is_active": True},
            {"name": "Royal Lorry", "type": "avatar", "cost": 150, "icon": "bus", "color": "#3498DB", "is_active": True},
            {"name": "Ghost Car", "type": "avatar", "cost": 300, "icon": "car-sport", "color": "#1ABC9C", "is_active": True},
            # Badges
            {"name": "Road Warrior", "type": "badge", "cost": 75, "icon": "shield", "color": "#E74C3C", "is_active": True},
            {"name": "Alert Master", "type": "badge", "cost": 100, "icon": "star", "color": "#F39C12", "is_active": True},
            {"name": "Top Reporter", "type": "badge", "cost": 150, "icon": "trophy", "color": "#27AE60", "is_active": True},
            # Voices (premium)
            {"name": "Adam Voice", "type": "voice", "cost": 200, "icon": "mic", "color": "#4A90E2", "voice_id": "adam", "is_active": True},
            {"name": "Rachel Voice", "type": "voice", "cost": 200, "icon": "mic", "color": "#E91E63", "voice_id": "rachel", "is_active": True},
            {"name": "Brian Voice", "type": "voice", "cost": 200, "icon": "mic", "color": "#9C27B0", "voice_id": "brian", "is_active": True},
        ]
        await db.rewards.insert_many(default_rewards)
        rewards = default_rewards
    
    return [{
        "id": str(r.get("_id", "")),
        "name": r["name"],
        "type": r["type"],
        "cost": r["cost"],
        "icon": r.get("icon"),
        "color": r.get("color"),
        "voice_id": r.get("voice_id")
    } for r in rewards]

@api_router.get("/rewards/owned")
async def get_owned_rewards(request: Request):
    user = await get_current_user(request)
    
    owned = await db.user_rewards.find({"user_id": user["_id"]}).to_list(100)
    
    return [str(o["reward_id"]) for o in owned]

@api_router.post("/rewards/purchase")
async def purchase_reward(purchase: PurchaseReward, request: Request):
    user = await get_current_user(request)
    
    # Get reward
    reward = await db.rewards.find_one({"_id": ObjectId(purchase.reward_id)})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    # Check if already owned
    existing = await db.user_rewards.find_one({
        "user_id": user["_id"],
        "reward_id": purchase.reward_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already owned")
    
    # Check points
    user_points = await db.user_points.find_one({"user_id": user["_id"]})
    current_points = user_points.get("total_points", 0) if user_points else 0
    
    if current_points < reward["cost"]:
        raise HTTPException(status_code=400, detail=f"Not enough points. Need {reward['cost']}, have {current_points}")
    
    # Deduct points and add reward
    await db.user_points.update_one(
        {"user_id": user["_id"]},
        {"$inc": {"total_points": -reward["cost"]}}
    )
    
    await db.user_rewards.insert_one({
        "user_id": user["_id"],
        "reward_id": purchase.reward_id,
        "reward_type": reward["type"],
        "purchased_at": datetime.now(timezone.utc)
    })
    
    return {"message": f"Purchased {reward['name']}"}

# ==================== USER SETTINGS ====================

@api_router.get("/settings")
async def get_user_settings(request: Request):
    user = await get_current_user(request)
    
    settings = await db.user_settings.find_one({"user_id": user["_id"]})
    
    if not settings:
        settings = {
            "user_id": user["_id"],
            "theme": "auto",
            "dark_mode_start": "19:00",
            "dark_mode_end": "06:00",
            "voice_id": "default",
            "sound_mode": "full",
            "speed_unit": "mph",
            "distance_unit": "miles",
            "safety_reminder_enabled": True,
            "avatar_id": "default",
            "home_address": None,
            "work_address": None
        }
        await db.user_settings.insert_one(settings)
    
    settings.pop("_id", None)
    settings.pop("user_id", None)
    
    return settings

@api_router.put("/settings")
async def update_user_settings(settings: UserSettings, request: Request):
    user = await get_current_user(request)
    
    await db.user_settings.update_one(
        {"user_id": user["_id"]},
        {"$set": settings.dict()},
        upsert=True
    )
    
    return {"message": "Settings updated"}

@api_router.put("/settings/address")
async def update_saved_address(address_type: str, address: str, lat: float, lng: float, request: Request):
    user = await get_current_user(request)
    
    if address_type not in ["home", "work"]:
        raise HTTPException(status_code=400, detail="Invalid address type")
    
    field = f"{address_type}_address"
    await db.user_settings.update_one(
        {"user_id": user["_id"]},
        {"$set": {field: {"address": address, "lat": lat, "lng": lng}}},
        upsert=True
    )
    
    return {"message": f"{address_type.title()} address saved"}

# ==================== CORPORATE ACCOUNTS ====================

@api_router.post("/corporate/create")
async def create_corporate_account(corp: CorporateAccountCreate, request: Request):
    user = await get_current_user(request)
    
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if company already exists
    existing = await db.corporate_accounts.find_one({"company_name": corp.company_name})
    if existing:
        raise HTTPException(status_code=400, detail="Company already exists")
    
    # Create corporate account
    corp_doc = {
        "company_name": corp.company_name,
        "admin_email": corp.admin_email.lower(),
        "max_vehicles": corp.max_vehicles,
        "safety_mode_enabled": corp.safety_mode_enabled,
        "employees": [],
        "created_by": user["_id"],
        "created_at": datetime.now(timezone.utc),
        "is_active": True
    }
    
    result = await db.corporate_accounts.insert_one(corp_doc)
    
    # Update the admin user to corporate tier
    await db.users.update_one(
        {"email": corp.admin_email.lower()},
        {"$set": {
            "subscription_tier": "corporate",
            "corporate_id": str(result.inserted_id),
            "is_corporate_admin": True
        }}
    )
    
    return {"message": "Corporate account created", "id": str(result.inserted_id)}

@api_router.get("/corporate/my-company")
async def get_my_corporate(request: Request):
    user = await get_current_user(request)
    
    corp_id = user.get("corporate_id")
    if not corp_id:
        raise HTTPException(status_code=404, detail="Not part of a corporate account")
    
    corp = await db.corporate_accounts.find_one({"_id": ObjectId(corp_id)})
    if not corp:
        raise HTTPException(status_code=404, detail="Corporate account not found")
    
    # Get employee count
    employee_count = len(corp.get("employees", []))
    vehicle_count = await db.vehicles.count_documents({"corporate_id": corp_id})
    
    return {
        "id": str(corp["_id"]),
        "company_name": corp["company_name"],
        "admin_email": corp["admin_email"],
        "max_vehicles": corp["max_vehicles"],
        "safety_mode_enabled": corp["safety_mode_enabled"],
        "employee_count": employee_count,
        "vehicle_count": vehicle_count,
        "is_admin": user.get("is_corporate_admin", False)
    }

@api_router.post("/corporate/add-employee")
async def add_employee(assignment: EmployeeAssignment, request: Request):
    user = await get_current_user(request)
    
    if not user.get("is_corporate_admin"):
        raise HTTPException(status_code=403, detail="Corporate admin access required")
    
    corp_id = user.get("corporate_id")
    if not corp_id:
        raise HTTPException(status_code=404, detail="Not part of a corporate account")
    
    # Find or create employee user
    employee = await db.users.find_one({"email": assignment.employee_email.lower()})
    
    if employee:
        # Update existing user
        await db.users.update_one(
            {"email": assignment.employee_email.lower()},
            {"$set": {
                "subscription_tier": "corporate",
                "corporate_id": corp_id,
                "is_corporate_admin": False,
                "assigned_vehicle_id": assignment.vehicle_id
            }}
        )
    
    # Add to corporate employees list
    await db.corporate_accounts.update_one(
        {"_id": ObjectId(corp_id)},
        {"$addToSet": {"employees": assignment.employee_email.lower()}}
    )
    
    return {"message": f"Employee {assignment.employee_email} added"}

@api_router.delete("/corporate/remove-employee/{email}")
async def remove_employee(email: str, request: Request):
    user = await get_current_user(request)
    
    if not user.get("is_corporate_admin"):
        raise HTTPException(status_code=403, detail="Corporate admin access required")
    
    corp_id = user.get("corporate_id")
    
    # Remove from corporate
    await db.corporate_accounts.update_one(
        {"_id": ObjectId(corp_id)},
        {"$pull": {"employees": email.lower()}}
    )
    
    # Update user back to free
    await db.users.update_one(
        {"email": email.lower()},
        {"$set": {
            "subscription_tier": "free",
            "corporate_id": None,
            "is_corporate_admin": False
        }}
    )
    
    return {"message": f"Employee {email} removed"}

@api_router.get("/corporate/employees")
async def get_employees(request: Request):
    user = await get_current_user(request)
    
    corp_id = user.get("corporate_id")
    if not corp_id:
        raise HTTPException(status_code=404, detail="Not part of a corporate account")
    
    corp = await db.corporate_accounts.find_one({"_id": ObjectId(corp_id)})
    if not corp:
        raise HTTPException(status_code=404, detail="Corporate account not found")
    
    employees = []
    for email in corp.get("employees", []):
        emp_user = await db.users.find_one({"email": email})
        if emp_user:
            employees.append({
                "id": str(emp_user["_id"]),
                "email": emp_user["email"],
                "name": emp_user["name"],
                "assigned_vehicle_id": emp_user.get("assigned_vehicle_id")
            })
    
    return employees

@api_router.put("/corporate/safety-mode")
async def toggle_safety_mode(enabled: bool, request: Request):
    user = await get_current_user(request)
    
    if not user.get("is_corporate_admin"):
        raise HTTPException(status_code=403, detail="Corporate admin access required")
    
    corp_id = user.get("corporate_id")
    
    await db.corporate_accounts.update_one(
        {"_id": ObjectId(corp_id)},
        {"$set": {"safety_mode_enabled": enabled}}
    )
    
    return {"message": f"Safety mode {'enabled' if enabled else 'disabled'}"}

# ==================== ALERT CONFIRMATION (for points) ====================

@api_router.post("/alerts/{alert_id}/confirm")
async def confirm_alert(alert_id: str, request: Request):
    user = await get_current_user(request)
    
    # Check if already confirmed by this user
    existing = await db.alert_confirmations.find_one({
        "alert_id": alert_id,
        "user_id": user["_id"]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Already confirmed this alert")
    
    # Add confirmation
    await db.alert_confirmations.insert_one({
        "alert_id": alert_id,
        "user_id": user["_id"],
        "confirmed_at": datetime.now(timezone.utc)
    })
    
    # Update alert upvotes
    await db.road_alerts.update_one(
        {"_id": ObjectId(alert_id)},
        {"$inc": {"upvotes": 1}}
    )
    
    # Award points to confirmer
    await db.user_points.update_one(
        {"user_id": user["_id"]},
        {"$inc": {"total_points": POINT_VALUES["confirm_alert"], "lifetime_points": POINT_VALUES["confirm_alert"]}},
        upsert=True
    )
    
    # Check if this verifies the original report (5+ confirmations)
    alert = await db.road_alerts.find_one({"_id": ObjectId(alert_id)})
    if alert and alert.get("upvotes", 0) >= 5:
        # Award bonus to original reporter
        await db.user_points.update_one(
            {"user_id": alert["created_by"]},
            {"$inc": {"total_points": POINT_VALUES["report_verified"], "lifetime_points": POINT_VALUES["report_verified"]}},
            upsert=True
        )
    
    return {"message": "Alert confirmed", "points_earned": POINT_VALUES["confirm_alert"]}

# Health check
@api_router.get("/")
async def root():
    return {"message": "CargoPaths API is running", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# Include routers
app.include_router(api_router)
app.include_router(auth_router)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Startup events
@app.on_event("startup")
async def startup_event():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.vehicles.create_index("user_id")
    await db.road_alerts.create_index([("latitude", 1), ("longitude", 1)])
    await db.road_restrictions.create_index([("latitude", 1), ("longitude", 1)])
    
    # Seed admin user
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@cargopaths.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "subscription_tier": "premium",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user created: {admin_email}")
    
    # Seed mock road restrictions for demonstration
    restriction_count = await db.road_restrictions.count_documents({})
    if restriction_count == 0:
        mock_restrictions = [
            {"restriction_type": "height", "latitude": 51.5074, "longitude": -0.1278, "limit_value": 4.0, "description": "Low bridge - Tower Bridge approach", "is_active": True},
            {"restriction_type": "weight", "latitude": 51.5155, "longitude": -0.1419, "limit_value": 7500, "description": "Weight restriction - Oxford Street", "is_active": True},
            {"restriction_type": "width", "latitude": 51.5033, "longitude": -0.1195, "limit_value": 2.5, "description": "Narrow road - Westminster", "is_active": True},
            {"restriction_type": "height", "latitude": 51.5226, "longitude": -0.1573, "limit_value": 3.8, "description": "Low railway bridge - Marylebone", "is_active": True},
            {"restriction_type": "weight", "latitude": 51.4974, "longitude": -0.1357, "limit_value": 18000, "description": "Bridge weight limit - Vauxhall", "is_active": True},
        ]
        await db.road_restrictions.insert_many(mock_restrictions)
        logger.info("Mock road restrictions seeded")
    
    # Seed mock alerts
    alert_count = await db.road_alerts.count_documents({})
    if alert_count == 0:
        mock_alerts = [
            {"alert_type": "speed_camera", "latitude": 51.5074, "longitude": -0.1278, "description": "Speed camera - 30mph", "speed_limit": 30, "created_by": "system", "created_at": datetime.now(timezone.utc), "upvotes": 15, "is_active": True},
            {"alert_type": "roadwork", "latitude": 51.5155, "longitude": -0.1419, "description": "Lane closure - roadworks", "estimated_end_date": "2025-08-15", "diversion_info": "Use A40 instead", "created_by": "system", "created_at": datetime.now(timezone.utc), "upvotes": 8, "is_active": True},
            {"alert_type": "school_zone", "latitude": 51.5033, "longitude": -0.1195, "description": "School zone - 20mph 8-9am, 3-4pm", "time_restriction_start": "08:00", "time_restriction_end": "09:00", "speed_limit": 20, "created_by": "system", "created_at": datetime.now(timezone.utc), "upvotes": 22, "is_active": True},
            {"alert_type": "hazard", "latitude": 51.5226, "longitude": -0.1573, "description": "Pothole - road surface damage", "created_by": "system", "created_at": datetime.now(timezone.utc), "upvotes": 5, "is_active": True},
            {"alert_type": "bump", "latitude": 51.4974, "longitude": -0.1357, "description": "Speed bump ahead", "created_by": "system", "created_at": datetime.now(timezone.utc), "upvotes": 12, "is_active": True},
        ]
        await db.road_alerts.insert_many(mock_alerts)
        logger.info("Mock road alerts seeded")
    
    # Update test credentials
    try:
        creds_path = Path("/app/memory/test_credentials.md")
        creds_path.parent.mkdir(parents=True, exist_ok=True)
        creds_path.write_text(f"""# Test Credentials\n\n## Admin Account\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n\n## Auth Endpoints\n- POST /api/auth/register\n- POST /api/auth/login\n- POST /api/auth/logout\n- GET /api/auth/me\n""")
    except Exception as e:
        logger.warning(f"Could not write test credentials: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
