import { mkdirSync, writeFileSync } from "node:fs";
import { URL } from "node:url";
mkdirSync(new URL("../public/illustrations/", import.meta.url), {
  recursive: true,
});
for (const [name, sky1, sky2, front, accent] of [
  ["city", "#587481", "#d1b394", "#172c37", "#e8c999"],
  ["night", "#122131", "#616b82", "#0e1925", "#db8b80"],
  ["event", "#c0b8a0", "#eee3c8", "#374b49", "#f1d58b"],
]) {
  let blocks = "";
  for (let i = 0; i < 23; i++) {
    const x = i * 65 - 50,
      h = 110 + ((i * 97) % 260),
      w = 45 + ((i * 13) % 25);
    blocks += `<rect x="${x}" y="${540 - h}" width="${w}" height="${h}" fill="${i % 2 ? front : "#566b73"}"/>`;
    for (let r = 0; r < h / 18 - 2; r++)
      for (let c = 0; c < Math.floor(w / 13) - 1; c++)
        if ((r + c + i) % 3)
          blocks += `<rect x="${x + 9 + c * 13}" y="${550 - h + r * 18}" width="4" height="6" fill="${accent}" opacity="${0.2 + (r % 3) * 0.2}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient><linearGradient id="shade" x2="0" y2="1"><stop stop-color="#10202b" stop-opacity="0"/><stop offset="1" stop-color="#10202b" stop-opacity=".85"/></linearGradient><pattern id="grain" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#fff" opacity=".08"/></pattern></defs><rect width="1400" height="900" fill="url(#sky)"/><circle cx="1070" cy="220" r="64" fill="${accent}" opacity=".35"/><path d="M0 425L190 308 310 380 490 270 685 405 910 310 1110 390 1400 260V680H0Z" fill="#7a8b8b" opacity=".4"/>${blocks}<path d="M0 675L1400 590V900H0Z" fill="${front}"/><path d="M600 590L795 590 1140 900H140Z" fill="#68787c"/><path d="M690 605L704 605 735 900H650Z" fill="${accent}" opacity=".6"/><path d="M0 750L1400 640" stroke="#b6b7a2" stroke-width="3" opacity=".3"/><g stroke="#182d35" stroke-width="15" fill="#182d35"><path d="M220 815Q250 500 213 355M1200 735Q1170 435 1210 340" fill="none"/><path d="M213 360Q100 285 65 385Q160 350 213 360M213 360Q245 240 330 298Q270 305 213 360M213 360Q330 320 355 422Q275 360 213 360M1210 340Q1110 250 1055 350Q1150 320 1210 340M1210 340Q1290 235 1360 310Q1290 300 1210 340M1210 340Q1310 320 1355 407Q1280 350 1210 340" stroke-width="4"/></g><rect width="1400" height="900" fill="url(#shade)"/><rect width="1400" height="900" fill="url(#grain)"/><path d="M54 60h40M54 60v40M1346 60h-40M1346 60v40" stroke="white" opacity=".5" fill="none"/><text x="55" y="825" font-family="Arial,sans-serif" font-size="13" fill="#fff" letter-spacing="4">SAN ANDREAS / ${name === "night" ? "AFTER HOURS" : name === "event" ? "CITY LIFE" : "METRO DESK"}</text><text x="55" y="855" font-family="Arial,sans-serif" font-size="10" fill="#fff" opacity=".6" letter-spacing="2">SANN ORIGINAL ILLUSTRATION · FICTIONAL RP SETTING</text></svg>`;
  writeFileSync(
    new URL(`../public/illustrations/${name}.svg`, import.meta.url),
    svg,
  );
}
