-- A room outlives its creator: deleting your account used to delete every room
-- you had created, even with other people still in it. (Rooms left with no
-- members are swept, see server/src/index.ts.)
alter table rooms
  alter column created_by drop not null,
  drop constraint rooms_created_by_fkey,
  add constraint rooms_created_by_fkey
    foreign key (created_by) references users(id) on delete set null;

-- The inbox query looks messages up by one participant; dm_pair_idx can't serve that.
create index dm_sender_idx on direct_messages (sender_id, created_at desc);
create index dm_recipient_idx on direct_messages (recipient_id, created_at desc);
-- "May this user open this file?" and the orphan sweep look messages up by attachment.
create index dm_attachment_idx on direct_messages (attachment_id) where attachment_id is not null;
-- Cascading deletes look attachments up by uploader.
create index attachments_uploader_idx on attachments (uploader_id);
