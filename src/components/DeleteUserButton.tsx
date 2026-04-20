"use client";

export function DeleteUserButton({ email }: { email: string | null }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        const ok = confirm(
          `Delete ${email ?? "this user"}?\n\nThis removes the account, profile, sessions, and all answers. This can't be undone.`,
        );
        if (!ok) e.preventDefault();
      }}
      className="text-xs text-red-600 hover:text-red-800 hover:underline"
    >
      Delete
    </button>
  );
}
