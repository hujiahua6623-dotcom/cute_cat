from __future__ import annotations

from typing import Any

from pydantic import BaseModel, EmailStr, Field


class ErrorBody(BaseModel):
    code: str
    message: str
    details: Any = None


class ErrorResponse(BaseModel):
    error: ErrorBody


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    nickname: str = Field(min_length=1, max_length=64)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refreshToken: str


class LogoutRequest(BaseModel):
    refreshToken: str


class TokenResponse(BaseModel):
    userId: str | None = None  # omitted on refresh
    accessToken: str
    accessExpiresIn: int
    refreshToken: str
    refreshExpiresIn: int


class MeResponse(BaseModel):
    userId: str
    nickname: str
    coins: int
    petId: str | None
    gardenId: str | None


class ClaimPetRequest(BaseModel):
    petName: str = Field(min_length=1, max_length=64)
    petType: str = Field(pattern="^(cat|dog|chick|duck|rabbit|pig)$")


class ClaimPetResponse(BaseModel):
    petId: str
    gardenId: str
    petType: str
    skinSeed: int
    birthdayGameDay: int


class PetSnapshotResponse(BaseModel):
    petId: str
    ownerUserId: str
    petName: str
    petType: str
    skinSeed: int
    growthStage: int
    gameTime: dict[str, Any]
    stats: dict[str, int]
    stability: dict[str, Any]
    memory: dict[str, Any]


class OfflineSummaryResponse(BaseModel):
    petId: str
    reasons: list[str]
    suggestedActionType: str
    sinceGameTime: dict[str, Any]
    untilGameTime: dict[str, Any]


class WsTicketResponse(BaseModel):
    wsUrl: str
    ticket: str
    expiresIn: int
    gardenId: str


class ShopBuyRequest(BaseModel):
    itemId: str = Field(min_length=1, max_length=64)
    count: int = Field(default=1, ge=1, le=99)


class ShopBuyResponse(BaseModel):
    itemId: str
    countAdded: int
    inventoryCount: int
    coinsAfter: int


class InventoryItemResponse(BaseModel):
    itemId: str
    count: int


class InventoryListResponse(BaseModel):
    items: list[InventoryItemResponse]


class HospitalTreatRequest(BaseModel):
    petId: str


class HospitalTreatResponse(BaseModel):
    petId: str
    treatCost: int
    coinsAfter: int
    stats: dict[str, int]
    delta: dict[str, int]


class ClientMessage(BaseModel):
    type: str
    requestId: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
