// Must match the server's literal in server/src/routes/v1/comments.ts exactly (A-08) -- this
// is a display-only parse, never sent back to the server as literal text. Shared by
// CommentSection.tsx (Requester-facing) and StaffTicketDetailPage.tsx (IT Staff-facing), which
// render the same "Problem Appears Resolved" badge over two different comment-fetch paths.
export const PROBLEM_RESOLVED_PREFIX = '[Requester marked: problem appears resolved] ';

export function displayCommentBody(body: string): { text: string; flagged: boolean } {
  if (body.startsWith(PROBLEM_RESOLVED_PREFIX)) {
    return { text: body.slice(PROBLEM_RESOLVED_PREFIX.length), flagged: true };
  }
  return { text: body, flagged: false };
}
