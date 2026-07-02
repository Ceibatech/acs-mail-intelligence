export type FollowupStatus = "open" | "in_progress" | "closed";
export type FollowupPriority = "low" | "medium" | "high" | "urgent";

export type FollowupRow = {
  id: number;
  message_id: number | null;
  mailbox_id: number | null;
  client_name: string | null;
  title: string;
  description: string | null;
  status: FollowupStatus | string;
  priority: FollowupPriority | string;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  linked_subject: string | null;
};

export type FollowupSummary = {
  open: number;
  overdue: number;
  dueToday: number;
  closed: number;
  highPriority: number;
};
