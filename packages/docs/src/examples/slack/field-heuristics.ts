/**
 * Slack-aware field heuristics for generating realistic mock data.
 *
 * Extracted from the spike at plugin-slack/scripts/spike-fastcheck.ts.
 * Uses faker for deterministic, realistic data generation.
 */
import { faker } from "@faker-js/faker";

/**
 * Lorem Picsum URL with deterministic dimensions.
 * @param w - Image width in pixels
 * @param h - Image height in pixels
 */
export function picsum(w: number, h: number): string {
  const id = faker.number.int({ min: 1, max: 1000 });
  return `https://picsum.photos/seed/${id}/${w}/${h}`;
}

/**
 * Map plural array field names to the singular form used for element generation.
 * `channels: string[]` -> each element generated as if field name were "channel".
 */
export function singularize(fieldName?: string): string | undefined {
  if (!fieldName) return undefined;
  const map: Record<string, string> = {
    channels: "channel",
    users: "user",
    groups: "team",
    ims: "channel",
    editors: "user",
    integrations: "app_id",
    pinned_to: "channel",
    mrkdwn_in: "key",
    app_collaborators: "user",
    initial_channels: "channel",
    initial_conversations: "channel",
    initial_users: "user",
    participant_history: "user",
    participants: "user",
    participants_camera_off: "user",
    participants_camera_on: "user",
    participants_screenshare_off: "user",
    participants_screenshare_on: "user",
    reply_users: "user",
    attached_file_ids: "id",
    errors: "error",
    messages: "text",
    linked_to: "key",
    select: "value",
    teams_shared_with: "team",
  };
  if (map[fieldName]) return map[fieldName];
  if (fieldName.endsWith("s") && fieldName.length > 1)
    return fieldName.slice(0, -1);
  return fieldName;
}

/** Slack-aware string generator using faker. */
export function fakeString(fieldName: string): string {
  // Slack IDs
  if (fieldName === "channel" || fieldName === "channel_id" || fieldName === "linked_channel_id")
    return `C${faker.string.alphanumeric(10).toUpperCase()}`;
  if (fieldName === "user" || fieldName === "user_id" || fieldName === "slack_id" ||
      fieldName === "created_by" || fieldName === "last_editor" || fieldName === "editor" ||
      fieldName === "inviter" || fieldName === "share_user_id" || fieldName === "updated_by" ||
      fieldName === "parent_user_id")
    return `U${faker.string.alphanumeric(10).toUpperCase()}`;
  if (fieldName === "team" || fieldName === "team_id" || fieldName === "source_team" ||
      fieldName === "user_team" || fieldName === "bot_team_id" || fieldName === "channel_team" ||
      fieldName === "icon_team_id" || fieldName === "emoji_team_id" || fieldName === "owning_team_id")
    return `T${faker.string.alphanumeric(10).toUpperCase()}`;
  if (fieldName === "bot_id")
    return `B${faker.string.alphanumeric(10).toUpperCase()}`;
  if (fieldName === "bot_user_id")
    return `U${faker.string.alphanumeric(10).toUpperCase()}`;
  if (fieldName === "app_id")
    return `A${faker.string.alphanumeric(10).toUpperCase()}`;
  if (fieldName === "id" || fieldName === "file_id" || fieldName === "client_msg_id" ||
      fieldName === "list_id" || fieldName === "record_id" || fieldName === "collection_id" ||
      fieldName === "column_id" || fieldName === "list_view_id" || fieldName === "workflow_id" ||
      fieldName === "function_trigger_id" || fieldName === "developer_trace_id" ||
      fieldName === "quip_thread_id" || fieldName === "reference_id" ||
      fieldName === "workflow_function_id" || fieldName === "display_id" ||
      fieldName === "external_display_id")
    return `F${faker.string.alphanumeric(10).toUpperCase()}`;
  if (fieldName === "call_id")
    return `R${faker.string.alphanumeric(10).toUpperCase()}`;

  // Timestamps (Slack ts format: epoch.microseconds)
  if (fieldName === "ts" || fieldName === "thread_ts" || fieldName === "latest_reply" ||
      fieldName === "last_read" || fieldName === "thread_root_ts" ||
      fieldName === "channel_actions_ts" || fieldName === "updated_timestamp")
    return `${faker.number.int({ min: 1700000000, max: 1720000000 })}.${faker.string.numeric(6)}`;

  // Text content
  if (fieldName === "text") return faker.lorem.sentence();
  if (fieldName === "title") return faker.lorem.words(3);
  if (fieldName === "name" || fieldName === "display_name") return faker.person.fullName();
  if (fieldName === "username" || fieldName === "author_name" || fieldName === "author_subname")
    return faker.internet.username();
  if (fieldName === "app_name" || fieldName === "service_name" || fieldName === "provider_name")
    return faker.company.name();
  if (fieldName === "channel_name" || fieldName === "collection_name")
    return faker.helpers.arrayElement(["general", "random", "engineering", "design", "announcements"]);
  if (fieldName === "subject") return faker.lorem.words(4);
  if (fieldName === "description" || fieldName === "template_description")
    return faker.lorem.sentence();
  if (fieldName === "comment") return faker.lorem.sentence();
  if (fieldName === "purpose" || fieldName === "topic") return faker.lorem.sentence();
  if (fieldName === "pretext" || fieldName === "fallback") return faker.lorem.sentence();
  if (fieldName === "plain_text" || fieldName === "preview_plain_text") return faker.lorem.paragraph();
  if (fieldName === "preview" || fieldName === "preview_highlight") return faker.lorem.paragraph();
  if (fieldName === "simplified_html") return `<p>${faker.lorem.sentence()}</p>`;
  if (fieldName === "button_label")
    return faker.helpers.arrayElement(["Submit", "Cancel", "Approve", "View Details"]);
  if (fieldName === "accessibility_label")
    return faker.helpers.arrayElement(["Select an option", "Click to expand", "Upload file"]);
  if (fieldName === "template_name" || fieldName === "template_title" || fieldName === "template_icon")
    return faker.lorem.words(2);
  if (fieldName === "content") return faker.lorem.paragraph();

  // Images -- Lorem Picsum
  if (fieldName === "permalink")
    return `https://${faker.internet.domainWord()}.slack.com/archives/C${faker.string.alphanumeric(10).toUpperCase()}/p${faker.string.numeric(16)}`;
  if (fieldName === "image_url") return picsum(800, 600);
  if (fieldName === "thumb_url" || fieldName === "thumb_tiny") return picsum(64, 64);
  if (fieldName === "service_icon" || fieldName === "footer_icon" || fieldName === "author_icon" ||
      fieldName === "icon_url" || fieldName === "provider_icon_url")
    return picsum(32, 32);
  if (fieldName === "avatar_url") return picsum(128, 128);
  const thumbMatch = fieldName.match(/^thumb_(\d+)(?:_gif)?$/);
  if (thumbMatch) return picsum(Number(thumbMatch[1]), Number(thumbMatch[1]));
  if (fieldName === "thumb_pdf") return picsum(612, 792);
  if (fieldName === "thumb_video") return picsum(640, 360);
  if (fieldName === "pjpeg") return picsum(800, 600);
  if (fieldName === "deanimate" || fieldName === "deanimate_gif") return picsum(400, 400);
  if (fieldName.startsWith("image_") && fieldName.match(/^image_\d+$/))
    return picsum(Number(fieldName.split("_")[1]), Number(fieldName.split("_")[1]));
  // General URLs (after image-specific checks)
  if (fieldName.endsWith("_url") || fieldName === "url" || fieldName === "from_url" ||
      fieldName === "original_url" || fieldName === "title_link" || fieldName === "author_link" ||
      fieldName === "edit_link" || fieldName === "service_url")
    return faker.internet.url();

  // Image dimensions (as strings in Slack's API)
  if (fieldName.startsWith("thumb_") && (fieldName.endsWith("_h") || fieldName.endsWith("_w")))
    return String(faker.number.int({ min: 32, max: 1024 }));
  if (fieldName === "original_h" || fieldName === "original_w")
    return String(faker.number.int({ min: 100, max: 2048 }));

  return fakeStringStatusAndMisc(fieldName);
}

/** Continuation of fakeString for status, state, and miscellaneous fields. */
function fakeStringStatusAndMisc(fieldName: string): string {
  if (fieldName === "error")
    return faker.helpers.arrayElement(["not_authed", "invalid_auth", "channel_not_found", "missing_scope"]);
  if (fieldName === "needed" || fieldName === "provided")
    return faker.helpers.arrayElement(["chat:write", "channels:read", "files:read", "users:read"]);
  if (fieldName === "address" || fieldName === "email") return faker.internet.email();
  if (fieldName === "action_id" || fieldName === "block_id" || fieldName === "callback_id" ||
      fieldName === "external_id" || fieldName === "external_unique_id")
    return faker.string.alphanumeric(12);
  if (fieldName === "value") return faker.string.alphanumeric(8);
  if (fieldName === "key")
    return faker.helpers.arrayElement(["priority", "status", "assignee", "due_date", "category"]);
  if (fieldName === "column" || fieldName === "variable")
    return faker.helpers.arrayElement(["col_a", "col_b", "col_c"]);
  if (fieldName === "color") return faker.color.rgb().replace("#", "");
  if (fieldName === "style") return faker.helpers.arrayElement(["primary", "danger", "default"]);
  if (fieldName === "access" || fieldName === "file_access" || fieldName === "org_or_workspace_access")
    return faker.helpers.arrayElement(["read", "write", "admin"]);
  if (fieldName === "state") return faker.helpers.arrayElement(["active", "archived", "completed"]);
  if (fieldName === "status" || fieldName === "summary_status")
    return faker.helpers.arrayElement(["ok", "completed", "pending", "in_progress"]);
  if (fieldName === "format" || fieldName === "date_format" || fieldName === "time_format" ||
      fieldName === "currency_format")
    return faker.helpers.arrayElement(["text", "json", "html", "YYYY-MM-DD", "HH:mm"]);
  if (fieldName === "mode") return faker.helpers.arrayElement(["hosted", "external", "snippet"]);
  if (fieldName === "filetype") return faker.helpers.arrayElement(["pdf", "png", "jpg", "txt", "py", "js"]);
  if (fieldName === "mimetype") return faker.system.mimeType();
  if (fieldName === "pretty_type")
    return faker.helpers.arrayElement(["PDF", "PNG", "JavaScript", "Python"]);
  if (fieldName === "extension") return faker.helpers.arrayElement(["pdf", "png", "jpg", "txt"]);
  if (fieldName === "locale") return faker.location.countryCode();
  if (fieldName === "timezone") return faker.location.timeZone();
  if (fieldName === "currency") return faker.finance.currencyCode();
  if (fieldName === "rounding") return faker.helpers.arrayElement(["up", "down", "nearest"]);
  if (fieldName === "type" || fieldName === "item_type" || fieldName === "event_type" ||
      fieldName === "external_type" || fieldName === "data_source" || fieldName === "media_display_type" ||
      fieldName === "media_backend_type" || fieldName === "canvas_template_mode" ||
      fieldName === "trigger_type" || fieldName === "trigger_subtype" || fieldName === "msg_subtype")
    return faker.helpers.arrayElement(["message", "file", "channel", "app_action", "workflow_step"]);
  if (fieldName === "subtype")
    return faker.helpers.arrayElement(["bot_message", "file_share", "channel_join"]);
  if (fieldName === "call_family") return faker.helpers.arrayElement(["huddle", "call"]);
  if (fieldName === "canvas_background") return faker.color.rgb();
  if (fieldName === "unicode") return faker.string.alphanumeric(5);
  if (fieldName === "emoji")
    return faker.helpers.arrayElement([":rocket:", ":thumbsup:", ":wave:", ":tada:"]);
  if (fieldName === "position") return String(faker.number.int({ min: 0, max: 100 }));
  if (fieldName === "label") return faker.lorem.words(2);
  if (fieldName === "range") return faker.helpers.arrayElement(["today", "this_week", "this_month"]);
  if (fieldName === "default_value") return faker.string.alphanumeric(6);
  if (fieldName === "operator")
    return faker.helpers.arrayElement(["is", "is_not", "contains", "gt", "lt"]);
  if (fieldName === "group_by" || fieldName === "group_by_column_id")
    return faker.helpers.arrayElement(["status", "assignee", "priority"]);
  if (fieldName === "can_record_summary")
    return faker.helpers.arrayElement(["allowed", "not_allowed"]);
  if (fieldName === "default_view_key")
    return faker.helpers.arrayElement(["all_items", "board", "calendar"]);
  if (fieldName === "video_html")
    return `<iframe src="${faker.internet.url()}" width="640" height="360"></iframe>`;
  if (fieldName === "vtt") return faker.internet.url();
  if (fieldName === "hls" || fieldName === "hls_embed") return faker.internet.url();
  if (fieldName === "mp4" || fieldName === "mp4_low") return faker.internet.url();
  if (fieldName === "converted_pdf") return faker.internet.url();
  if (fieldName === "list_csv_download_url") return faker.internet.url();
  if (fieldName === "original") return faker.internet.email();
  if (fieldName === "media_server") return faker.internet.domainName();
  if (fieldName === "date" || fieldName.startsWith("initial_date"))
    return faker.date.recent().toISOString().split("T")[0];
  if (fieldName === "initial_time")
    return `${faker.number.int({ min: 0, max: 23 }).toString().padStart(2, "0")}:${faker.number.int({ min: 0, max: 59 }).toString().padStart(2, "0")}`;
  if (fieldName === "message_id" || fieldName === "in_reply_to" || fieldName === "reply_to")
    return `<${faker.string.alphanumeric(12)}@${faker.internet.domainName()}>`;

  return faker.lorem.word();
}

/** Slack-aware number generator using faker. */
export function fakeNumber(fieldName: string): number {
  if (fieldName.startsWith("date_") || fieldName === "created" || fieldName === "updated" ||
      fieldName === "timestamp" || fieldName === "edit_timestamp" || fieldName === "template_conversion_ts")
    return faker.number.int({ min: 1700000000, max: 1720000000 });
  if (fieldName.endsWith("_count") || fieldName === "lines" || fieldName === "lines_more" ||
      fieldName === "num_stars")
    return faker.number.int({ min: 0, max: 25 });
  if (fieldName === "size") return faker.number.int({ min: 100, max: 500000 });
  if (fieldName === "duration_ms") return faker.number.int({ min: 1000, max: 300000 });
  if (fieldName.endsWith("_ms")) return faker.number.int({ min: 0, max: 60000 });
  if (fieldName === "image_height" || fieldName === "image_width" ||
      fieldName === "image_bytes" || fieldName === "thumb_height" || fieldName === "thumb_width")
    return faker.number.int({ min: 32, max: 2048 });
  if (fieldName.startsWith("thumb_") && (fieldName.endsWith("_h") || fieldName.endsWith("_w")))
    return faker.number.int({ min: 32, max: 1024 });
  if (fieldName === "video_html_height" || fieldName === "video_html_width")
    return faker.number.int({ min: 200, max: 1920 });
  if (fieldName === "rotation" || fieldName === "image_exif_rotation")
    return faker.helpers.arrayElement([0, 90, 180, 270]);
  if (fieldName === "indent" || fieldName === "offset" || fieldName === "border")
    return faker.number.int({ min: 0, max: 4 });
  if (fieldName === "precision") return faker.number.int({ min: 0, max: 4 });
  if (fieldName === "skin_tone") return faker.number.int({ min: 1, max: 5 });
  if (fieldName === "id") return faker.number.int({ min: 1, max: 999 });
  if (fieldName === "width") return faker.number.int({ min: 50, max: 500 });
  if (fieldName === "max" || fieldName === "min") return faker.number.int({ min: 0, max: 100 });
  return faker.number.int({ min: 0, max: 1000 });
}
