import React from "react";

/** Short welcome line above the login form. */
export default function BeforeLogin() {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ margin: 0, fontSize: 14, opacity: 0.75 }}>
        Welcome to <strong>METNMAT Operations</strong>. Sign in to manage the website — products,
        content, enquiries and settings.
      </p>
    </div>
  );
}
