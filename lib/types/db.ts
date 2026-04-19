export type Lead = {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  business_name: string;
  website_url: string;
  category: string;
  status: string;
};

export type Asset = {
  id: string;
  created_at: string;
  updated_at: string;
  lead_id: string;
  type: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  metadata: Record<string, unknown> | null;
};

export type VideoJobMetadata = {
  ltx_model_id?: string;
  duration_sec?: number;
};

export type VideoJob = {
  id: string;
  created_at: string;
  updated_at: string;
  lead_id: string;
  status: string;
  ltx_job_id: string | null;
  error_message: string | null;
  render_storage_path: string | null;
  prompt_snapshot: string | null;
  /** Present for jobs created after metadata migration; includes model and duration. */
  metadata?: VideoJobMetadata | null;
};
