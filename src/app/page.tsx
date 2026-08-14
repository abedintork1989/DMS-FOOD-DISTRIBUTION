"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { Vazirmatn } from "next/font/google";
import { supabase } from "@/lib/supabase";

// فونت اصلی رابط کاربری — Vazirmatn: خوانا، مدرن و پرکاربردترین فونت فارسی در طراحی وب امروز
const vazir = Vazirmatn({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-vazir",
  display: "swap",
});

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
    <main className={`naser-login-page ${vazir.variable}`}>
      {/* پس‌زمینه را با فایل خودتان جایگزین کنید: public/naser-login-bg.png */}
      <div className="naser-login-overlay" />

      <section className="naser-login-shell" dir="rtl">
        <div className="naser-login-card">
          <div className="naser-card-header">
            <div className="naser-card-headtext">
              <span className="naser-eyebrow">خوش آمدید</span>
              <h1>ورود به حساب کاربری</h1>
              <p>برای ادامه، اطلاعات ورود خود را وارد کنید.</p>
            </div>

            <div className="naser-shield-badge" aria-hidden="true">
              <svg viewBox="0 0 100 100" width="26" height="26">
                <path
                  d="M50 4 L90 18 V50 C90 75 72 90 50 98 C28 90 10 75 10 50 V18 Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="7"
                />
                <rect x="38" y="46" width="24" height="20" rx="4" fill="currentColor" />
                <path
                  d="M42 46 V38 C42 32.5 45.6 28 50 28 C54.4 28 58 32.5 58 38 V46"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                />
              </svg>
            </div>
          </div>

          <form onSubmit={login} className="naser-login-form">
            {error && (
              <div className="naser-login-error" role="alert">
                {error}
              </div>
            )}

            <label className="naser-field">
              <span>نام کاربری</span>
              <div className="naser-input-shell">
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="A.Tork"
                  autoComplete="username"
                  disabled={loading}
                  dir="ltr"
                />
                <User className="naser-input-icon" size={18} />
              </div>
            </label>

            <label className="naser-field">
              <span>رمز عبور</span>
              <div className="naser-input-shell">
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
                  disabled={loading}
                  className="naser-password-toggle"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  dir="ltr"
                />
                <LockKeyhole className="naser-input-icon" size={18} />
              </div>
            </label>

            <button className="naser-submit" disabled={loading}>
              <span>{loading ? "در حال ورود..." : "ورود به سیستم"}</span>
              {!loading && <span className="naser-submit-arrow">←</span>}
            </button>
          </form>

          <div className="naser-login-footer">
            <span>دسترسی امن و داخلی سازمان</span>
            <span>Naser Food Industry | ناصر</span>
          </div>
        </div>
      </section>

      <style jsx>{`
        .naser-login-page {
          --font-body: var(--font-vazir), system-ui, sans-serif;
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #0c5236;
          background-image: url("/naser-login-bg.png");
          background-position: center center;
          background-size: cover;
          background-repeat: no-repeat;
          font-family: var(--font-body);
        }

        .naser-login-overlay {
          position: absolute;
          inset: 0;
          background: transparent;
          pointer-events: none;
        }

        .naser-login-shell {
          width: 480px;
          height: 546px;
          padding: 0;
          position: relative;
          z-index: 2;
          flex: 0 0 auto;
          transform: translateY(11.5vh) scale(0.8);
          transform-origin: center center;
        }

        .naser-login-card {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          position: relative;
          display: flex;
          flex-direction: column;
          border-radius: 29px;
          padding: 32px 34px 24px;
          background: rgba(247, 250, 248, 0.90);
          border: 1px solid rgba(255, 255, 255, 0.94);
          box-shadow:
            0 26px 70px rgba(10, 50, 32, 0.18),
            0 4px 18px rgba(10, 50, 32, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .naser-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }

        .naser-eyebrow {
          display: block;
          color: #6e8477;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 7px;
        }

        .naser-card-headtext h1 {
          margin: 0 0 7px;
          color: #173c2d;
          font-size: 28px;
          line-height: 1.28;
          font-weight: 800;
          letter-spacing: -0.35px;
          font-family: var(--font-body);
        }

        .naser-card-headtext p {
          margin: 0;
          color: #84958c;
          font-size: 12.5px;
          line-height: 1.8;
        }

        .naser-shield-badge {
          flex-shrink: 0;
          width: 54px;
          height: 54px;
          border-radius: 17px;
          display: grid;
          place-items: center;
          color: #ffffff;
          background: linear-gradient(145deg, #16885a 0%, #0b5d3a 100%);
          box-shadow:
            0 12px 24px rgba(11, 93, 58, 0.23),
            inset 0 1px 0 rgba(255, 255, 255, 0.22);
        }

        .naser-login-form {
          margin-top: 27px;
          display: grid;
          gap: 16px;
          flex: 1;
        }

        .naser-login-error {
          padding: 11px 13px;
          border-radius: 14px;
          background: rgba(185, 28, 28, 0.08);
          border: 1px solid rgba(185, 28, 28, 0.16);
          color: #991b1b;
          font-size: 13px;
          font-weight: 700;
        }

        .naser-field > span {
          display: block;
          margin: 0 3px 7px;
          color: #294b3c;
          font-size: 12.5px;
          font-weight: 700;
        }

        .naser-input-shell {
          min-height: 54px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 13px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.90);
          border: 1px solid rgba(216, 225, 219, 0.95);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.95),
            0 2px 8px rgba(19, 58, 42, 0.035);
          transition: 160ms ease;
        }

        .naser-input-shell:focus-within {
          border-color: rgba(18, 146, 92, 0.5);
          box-shadow: 0 0 0 4px rgba(18, 146, 92, 0.1);
        }

        .naser-input-shell input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #173a2c;
          font-family: var(--font-body);
          font-weight: 500;
          font-size: 15px;
          line-height: 1;
        }

        .naser-input-shell input::placeholder {
          color: #9aa79f;
        }

        .naser-input-icon {
          color: #6f877a;
          flex-shrink: 0;
        }

        .naser-password-toggle {
          flex-shrink: 0;
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 10px;
          display: grid;
          place-items: center;
          color: #708a7c;
          background: transparent;
          cursor: pointer;
          transition: 150ms ease;
        }

        .naser-password-toggle:hover:not(:disabled) {
          color: #0b6a40;
          background: rgba(11, 106, 64, 0.08);
        }

        .naser-submit {
          margin-top: auto;
          min-height: 54px;
          border: 0;
          border-radius: 16px;
          padding: 0 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #ffffff;
          background: linear-gradient(135deg, #148d5a 0%, #0a5e3a 100%);
          box-shadow:
            0 13px 25px rgba(10, 94, 58, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.18);
          font-family: var(--font-body);
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease;
        }

        .naser-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 20px 32px rgba(10, 92, 57, 0.32);
        }

        .naser-submit:disabled {
          cursor: not-allowed;
          opacity: 0.72;
        }

        .naser-submit-arrow {
          font-size: 20px;
          line-height: 1;
          opacity: 0.9;
        }

        .naser-login-footer {
          margin-top: 18px;
          padding-top: 14px;
          border-top: 1px solid rgba(20, 39, 32, 0.07);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          color: #95a39b;
          font-size: 10.5px;
        }

        @media (max-width: 600px) {
          .naser-login-shell {
            width: min(480px, calc(100vw - 28px));
            height: auto;
            min-height: 546px;
            padding: 0;
            transform: translateY(4vh);
          }

          .naser-login-card {
            height: auto;
            min-height: 546px;
            padding: 26px 22px 22px;
            border-radius: 25px;
          }

          .naser-card-headtext h1 {
            font-size: 24px;
          }

          .naser-login-footer {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </main>
  );
}
