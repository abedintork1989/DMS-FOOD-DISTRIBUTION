"use client";

import { FormEvent, useState } from "react";
import { Boxes, Eye, EyeOff, Leaf } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type LoginUser = {
  username: "A.Tork" | "A.Najari";
  email: string;
  role: "manager" | "visitor";
  name: string;
};

const USERS: Record<string, LoginUser> = {
  "A.Tork": {
    username: "A.Tork",
    email: "a.tork@local.app",
    role: "manager",
    name: "مدیر سیستم",
  },
  "A.Najari": {
    username: "A.Najari",
    email: "a.najari@local.app",
    role: "visitor",
    name: "ویزیتور",
  },
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");

    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      setError("نام کاربری و رمز عبور را وارد کنید.");
      return;
    }

    const selectedUser = USERS[cleanUsername];
    if (!selectedUser) {
      setError("نام کاربری اشتباه است.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: selectedUser.email,
        password,
      });

      if (loginError || !data.session || !data.user) {
        setError("نام کاربری یا رمز عبور اشتباه است.");
        return;
      }

      localStorage.setItem(
        "dms_user",
        JSON.stringify({
          username: selectedUser.username,
          role: selectedUser.role,
          name: selectedUser.name,
          supabase_user_id: data.user.id,
        })
      );

      router.push(selectedUser.role === "manager" ? "/dashboard" : "/orders");
    } catch {
      setError("خطایی هنگام ورود رخ داد.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="botanical-login-page">
      <div className="login-ambient login-ambient-one" />
      <div className="login-ambient login-ambient-two" />

      <section className="botanical-login-card">
        <aside className="login-art-panel" aria-hidden="true">
          <div className="art-copy">
            <span className="art-kicker"><Leaf size={16} /> مدیریت هوشمند</span>
            <h2>همه‌چیز برای مدیریت بهتر پخش</h2>
            <p>ساده، سریع و مطمئن؛ همراه تیم شما در هر روز کاری.</p>
          </div>
          <div className="art-sun" />
          <span className="leaf leaf-one" />
          <span className="leaf leaf-two" />
          <span className="leaf leaf-three" />
          <span className="leaf leaf-four" />
          <span className="leaf leaf-five" />
          <span className="leaf leaf-six" />
        </aside>

        <div className="botanical-form-panel">
          <div className="login-brand-mark"><Boxes size={28} /></div>
          <div className="login-heading">
            <span>خوش آمدید</span>
            <h1>سیستم مدیریت پخش</h1>
            <p>Distribution Management System</p>
          </div>

          <form onSubmit={login} className="botanical-login-form">
            {error && <div className="login-error">{error}</div>}

            <label className="botanical-field">
              <span>نام کاربری</span>
              <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="A.Tork" autoComplete="username" disabled={loading} />
            </label>

            <label className="botanical-field">
              <span>رمز عبور</span>
              <div className="botanical-password">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={loading} />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}>
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </label>

            <button className="botanical-submit" disabled={loading}>
              {loading ? "در حال ورود..." : "ورود به سیستم"}
            </button>
          </form>

          <p className="login-help">برای ورود از نام کاربری سازمانی خود استفاده کنید.</p>
        </div>
      </section>
    </main>
  );
}
