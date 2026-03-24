import { httpJson } from "./httpClient";
import type {
  ClaimPetResponse,
  HospitalTreatResponse,
  InventoryListResponse,
  MeResponse,
  OfflineSummaryResponse,
  PetSnapshotResponse,
  ShopBuyResponse,
  TokenResponse,
} from "./types";

export async function register(email: string, password: string, nickname: string): Promise<TokenResponse> {
  return httpJson<TokenResponse>("/auth/register", {
    method: "POST",
    body: { email, password, nickname },
  });
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  return httpJson<TokenResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function getMe(): Promise<MeResponse> {
  return httpJson<MeResponse>("/me");
}

export async function claimPet(petName: string, petType: string): Promise<ClaimPetResponse> {
  return httpJson<ClaimPetResponse>("/pets/claim", {
    method: "POST",
    body: { petName, petType },
  });
}

export async function getPet(petId: string): Promise<PetSnapshotResponse> {
  return httpJson<PetSnapshotResponse>(`/pets/${encodeURIComponent(petId)}`);
}

export async function getOfflineSummary(petId: string): Promise<OfflineSummaryResponse> {
  return httpJson<OfflineSummaryResponse>(`/offline-summary?petId=${encodeURIComponent(petId)}`);
}

export async function shopBuy(itemId: string, count = 1): Promise<ShopBuyResponse> {
  return httpJson<ShopBuyResponse>("/shop/buy", {
    method: "POST",
    body: { itemId, count },
  });
}

export async function getInventory(): Promise<InventoryListResponse> {
  return httpJson<InventoryListResponse>("/shop/inventory");
}

export async function hospitalTreat(petId: string): Promise<HospitalTreatResponse> {
  return httpJson<HospitalTreatResponse>("/hospital/treat", {
    method: "POST",
    body: { petId },
  });
}
