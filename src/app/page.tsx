"use client";

import { FormEvent, useState } from "react";
import { Boxes } from "lucide-react";
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

  async function login(e: FormEvent) {
    e.preventDefault();

    setError("");

    const cleanUsername = username.trim();

    if (!cleanUsername || !password) {
      setError("نام کاربری و رمز عبور را وارد کنید.");
      return;
    }

    const selectedUser = USERS[cleanUsername];

    if (!selectedUser) {
      setError(
        "نام کاربری اشتباه است. از A.Tork یا A.Najari استفاده کنید."
      );
      return;
    }

    setLoading(true);

    try {
      /*
       * ورود واقعی به Supabase Auth
       *
       * کاربر همچنان فقط نام کاربری خودش را وارد می‌کند.
       * ایمیل‌های زیر فقط شناسه داخلی Supabase Auth هستند.
       */
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: selectedUser.email,
          password,
        });

      if (loginError) {
        console.error("SUPABASE LOGIN ERROR:", loginError);

        setError(
          "نام کاربری یا رمز عبور اشتباه است، یا این کاربر هنوز در Supabase ساخته نشده است."
        );

        return;
      }

      if (!data.session || !data.user) {
        setError(
          "ورود انجام شد ولی Session واقعی Supabase ساخته نشد."
        );

        return;
      }

      /*
       * این localStorage را فعلاً نگه می‌داریم تا بخش‌های قدیمی
       * برنامه که از dms_user استفاده می‌کنند همچنان کار کنند.
       *
       * امنیت و احراز هویت واقعی از اینجا به بعد با Supabase Auth است.
       */
      localStorage.setItem(
        "dms_user",
        JSON.stringify({
          username: selectedUser.username,
          role: selectedUser.role,
          name: selectedUser.name,
          supabase_user_id: data.user.id,
        })
      );

      console.log("LOGIN SUCCESS:", {
        username: selectedUser.username,
        role: selectedUser.role,
        supabase_user_id: data.user.id,
      });

      if (selectedUser.role === "manager") {
        router.push("/dashboard");
      } else {
        router.push("/orders");
      }
    } catch (loginException) {
      console.error("LOGIN EXCEPTION:", loginException);

      setError(
        "خطایی هنگام ورود رخ داد. لطفاً دوباره تلاش کنید."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-icon">
            <Boxes size={22} />
          </div>

          <h1>سیستم مدیریت شرکت پخش</h1>

          <p>
            مدیریت مشتریان، سفارشات و امور مالی
          </p>
        </div>

        <form
          className="login-form"
          onSubmit={login}
        >
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <div className="form-field">
            <label>نام کاربری</label>

            <input
              className="input"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              placeholder="نام کاربری"
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label>رمز عبور</label>

            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="رمز عبور"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "در حال ورود..."
              : "ورود به سیستم"}
          </button>
        </form>

        <div className="login-hint">
          <b>کاربران سیستم:</b>
          <br />
          مدیر: A.Tork
          <br />
          ویزیتور: A.Najari
        </div>
      </section>
    </main>
  );
}
