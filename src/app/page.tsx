"use client";

import { FormEvent, useState } from "react";
import { Boxes } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function login(e: FormEvent) {
    e.preventDefault();
    if (username === "admin" && password === "1234") {
      localStorage.setItem("dms_user", JSON.stringify({ username, role: "manager", name: "مدیر سیستم" }));
      router.push("/dashboard");
      return;
    }
    if (username === "visitor" && password === "1234") {
      localStorage.setItem("dms_user", JSON.stringify({ username, role: "visitor", name: "ویزیتور" }));
      router.push("/orders");
      return;
    }
    setError("نام کاربری یا رمز عبور اشتباه است.");
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-icon"><Boxes size={22} /></div>
          <h1>سیستم مدیریت شرکت پخش</h1>
          <p>مدیریت مشتریان، سفارشات و امور مالی</p>
        </div>

        <form className="login-form" onSubmit={login}>
          {error && <div className="login-error">{error}</div>}

          <div className="form-field">
            <label>نام کاربری</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="نام کاربری" />
          </div>

          <div className="form-field">
            <label>رمز عبور</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="رمز عبور" />
          </div>

          <button className="btn btn-primary" type="submit">ورود به سیستم</button>
        </form>

        <div className="login-hint">
          <b>ورود آزمایشی:</b><br />
          مدیر: admin / 1234<br />
          ویزیتور: visitor / 1234
        </div>
      </section>
    </main>
  );
}
