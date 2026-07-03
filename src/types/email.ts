export type EmailSearchRow = {
  id: number;
  mailbox: string;
  folder: string | null;
  email_date: string | null;
  imported_at: string | null;
  from_header: string | null;
  to_header: string | null;
  subject: string | null;
  size_bytes: number | null;
};

export type MessageTag = {
  id: number;
  tag: string;
  category: string | null;
  confidence: number | null;
  tag_source: string | null;
  created_at: string | null;
};

export type LinkedFollowup = {
  id: number;
  title: string;
  client_name: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string | null;
};

export type EmailDetail = EmailSearchRow & {
  message_id: string | null;
  cc_header: string | null;
  bcc_header: string | null;
  body_text: string | null;
  body_html: string | null;
  body_preview: string | null;
  body_length: number | null;
  extraction_status: string | null;
  has_body: number | boolean | null;
  raw_path?: string | null;
  tags: MessageTag[];
  followups: LinkedFollowup[];
};

export type EmailSearchResponse = {
  rows: EmailSearchRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
