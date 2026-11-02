# @qlam/inbox

Cloudflare Email Worker for Qlam.

This worker will receive inbound emails to Qlam user inbox addresses (e.g. applications, recruiter responses), parse email bodies and headers, extract application status updates, and sync them to Supabase.
