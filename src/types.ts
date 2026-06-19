export interface RobloxProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

export interface Submission {
  id: string;
  username: string;
  imageProof: string; // Base64
  gamepassLink: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface SubmissionStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}
