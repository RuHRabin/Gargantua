import { useEffect, useState } from "react";

export function TarsIcon({ active }: { active: boolean }) {
  return (
    <div className="flex gap-[3px] items-end h-9">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="w-[7px] bg-gradient-to-b from-stone-300 to-stone-600 transition-all duration-500"
          style={{
            height: active ? `${60 + ((i * 37) % 40)}%` : "100%",
            transform: active ? `translateY(${i % 2 ? -3 : 2}px)` : "none",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,.4)",
          }}
        />
      ))}
    </div>
  );
}

export function TarsMessage({ text, id }: { text: string; id: number }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(iv);
    }, 18);
    return () => clearInterval(iv);
  }, [text, id]);
  const typing = shown.length < text.length;
  return (
    <div className="hud-panel fade-up flex items-center gap-4 px-5 py-3 max-w-xl">
      <TarsIcon active={typing} />
      <p className="font-mono text-[12px] leading-relaxed tracking-wide text-stone-200">
        {shown}
        <span className="pulse-line">▍</span>
      </p>
    </div>
  );
}
