import { useId } from "react";
import type { Lesson } from "../game/learning";

export function LessonDiagram({ type, clockRatio = 2.4 }: { type: Lesson["diagram"]; clockRatio?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="lesson-diagram" viewBox="0 0 600 200" role="img" aria-label={`${type} science illustration`}>
      <defs>
        <radialGradient id={`${id}glow`}><stop stopColor="#f1bd7d" stopOpacity=".38" /><stop offset="1" stopColor="#f1bd7d" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}ray`}><stop stopColor="#82b8d9" stopOpacity="0" /><stop offset=".45" stopColor="#82b8d9" /><stop offset="1" stopColor="#e1b880" /></linearGradient>
      </defs>
      <g stroke="#50534f" strokeWidth=".7" fill="none" opacity=".25"><path d="M20 100h560M300 15v170" /><circle cx="300" cy="100" r="78" strokeDasharray="2 7" /></g>
      {type === "hole" && <>
        <ellipse cx="300" cy="100" rx="190" ry="80" fill={`url(#${id}glow)`} />
        <ellipse cx="300" cy="100" rx="163" ry="24" fill="none" stroke="#c99b66" strokeWidth="5" opacity=".6" />
        <ellipse cx="300" cy="100" rx="128" ry="15" fill="none" stroke="#e8c89c" strokeWidth="1.5" />
        <circle cx="300" cy="100" r="49" fill="#070a0b" stroke="#eec291" strokeWidth="1.4" />
        <path d="M216 99c0-94 169-94 169 0M243 103c0 73 114 73 114 0" fill="none" stroke="#ddb58a" strokeWidth="2" />
        <path d="M365 55h45l15-17M218 131h-67l-12 20" fill="none" stroke="#74736a" />
        <text x="428" y="37">BENT LIGHT</text><text x="70" y="165">ONE DISK</text>
      </>}
      {type === "orbit" && <>
        <circle cx="300" cy="100" r="22" fill={`url(#${id}glow)`} stroke="#d9b682" />
        <ellipse cx="300" cy="100" rx="190" ry="64" fill="none" stroke="#727e83" strokeDasharray="4 5" />
        <ellipse className="diagram-orbit" cx="300" cy="100" rx="128" ry="48" fill="none" stroke="#c5a476" />
        <circle cx="428" cy="100" r="6" fill="#e9c292" /><path d="m426 89-10-17m12 1-12-1 0 12M415 100h-63m9-5-9 5 9 5" fill="none" stroke="#99bed1" />
        <text x="432" y="63">VELOCITY</text><text x="316" y="147">GRAVITY</text>
      </>}
      {type === "thrust" && <>
        <path d="m274 66 59 34-59 34 9-24h-36V90h36Z" fill="#a7aaa4" stroke="#d7d9d0" />
        <path d="M184 87h52M167 100h69M188 113h48" stroke="#c29861" strokeWidth="2" strokeDasharray="5 7" />
        <path d="M355 100h94m-12-8 12 8-12 8M160 100H95m12-8-12 8 12 8" fill="none" stroke="#a7cce0" />
        <text x="354" y="74">SHIP MOMENTUM</text><text x="84" y="145">EXHAUST MOMENTUM</text>
      </>}
      {type === "light" && <>
        <circle cx="140" cy="100" r="70" fill={`url(#${id}glow)`} /><circle cx="140" cy="100" r="23" fill="none" stroke="#d9b682" />
        {[65, 85, 105, 125].map((y) => <path key={y} d={`M186 ${y}h138m-9-5 9 5-9 5`} fill="none" stroke={`url(#${id}ray)`} />)}
        <g transform="translate(340 59) skewY(-12)" stroke="#92b9d0" fill="#10202a"><rect width="90" height="80" />{[22, 45, 67].map((x) => <path key={x} d={`M${x} 0v80`} />)}<path d="M0 27h90M0 54h90" /></g>
        <path d="M444 100h48l-6-5m6 5-6 5" stroke="#d9b682" fill="none" /><text x="109" y="155">LIGHT</text><text x="448" y="128">POWER</text>
      </>}
      {type === "clock" && <>
        {[195, 405].map((x, i) => <g key={x}><circle cx={x} cy="91" r="45" stroke={i ? "#94bed5" : "#d0af7c"} fill="none" /><circle cx={x} cy="91" r="2" fill="#d9c9b0" /><path className={i ? "clock-hand fast" : "clock-hand"} style={{ transformOrigin: `${x}px 91px`, animationDuration: `${i ? 12 / clockRatio : 12}s` }} d={`M${x} 91v-32`} stroke={i ? "#94bed5" : "#d0af7c"} /><path d={`M${x} 91l20 12`} stroke="#a4a39a" /><text x={x} y="163" textAnchor="middle">{i ? "DISTANT CLOCK" : "DEEPER CLOCK"}</text></g>)}
        <path d="M263 92h76m-8-5 8 5-8 5" stroke="#72786f" fill="none" />
      </>}
      {type === "world" && <>
        <circle cx="300" cy="100" r="67" fill="#152431" stroke="#92b6c9" /><ellipse cx="300" cy="100" rx="67" ry="22" fill="none" stroke="#647b85" /><ellipse cx="300" cy="100" rx="28" ry="67" fill="none" stroke="#647b85" /><path d="M233 100h134M300 33v134" stroke="#647b85" /><ellipse cx="300" cy="100" rx="115" ry="36" fill="none" stroke="#c4a677" strokeDasharray="3 5" /><circle cx="414" cy="98" r="4" fill="#e4c49a" /><text x="456" y="100">SURVEY</text>
      </>}
      {type === "cube" && <g className="diagram-cube" fill="none" stroke="#d2b17f"><path d="M220 45h128v120H220Zm32-25h128v120H252Zm-32 25 32-25m96 25 32-25m-160 145 32-25m96 25 32-25M262 69h47v47h-47Zm14-13h47v47h-47Zm-14 13 14-13m33 13 14-13m-61 60 14-13m33 13 14-13M220 45l42 24m86-24-39 24m-89 96 42-49m86 49-39-49" /><text x="430" y="98">4D TO 3D</text></g>}
    </svg>
  );
}