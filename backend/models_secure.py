from pydantic import BaseModel, constr

class UserBase(BaseModel):
    username: constr(min_length=3, max_length=50)
    email: constr(regex=r'^[\w\.-]+@[\w\.-]+\.\w+$')

class UserCreate(UserBase):
    password: constr(min_length=8, max_length=128)

    @classmethod
    def validate_password(cls, value: str) -> str:
        if not any(char.isdigit() for char in value):
            raise ValueError('Password must contain at least one digit.')
        if not any(char.isupper() for char in value):
            raise ValueError('Password must contain at least one uppercase letter.')
        if not any(char.islower() for char in value):
            raise ValueError('Password must contain at least one lowercase letter.')
        return value

class UserInDB(UserBase):
    hashed_password: str

# Additional models as required for sanitization and security constraints
