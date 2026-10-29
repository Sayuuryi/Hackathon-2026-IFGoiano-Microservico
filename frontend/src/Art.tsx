import { useId } from "react";
import images from "./illustrations.json";
import type { Profile } from "./types";
const palettes = [
  [
    "#edceaa",
    "#d7aa80",
    "#d7aa80",
    "#f4dfc8",
    "#e0b68e",
    "#b48968",
    "#f7e7d3",
    "#dba194",
    "#644d46",
  ],
  [
    "#d6c8e8",
    "#ad98c5",
    "#b8a4cb",
    "#eee4f7",
    "#c1add8",
    "#8f79a7",
    "#eee5f7",
    "#cca3b9",
    "#5f4b70",
  ],
  [
    "#d1ddb7",
    "#a6bd88",
    "#b0c596",
    "#e6edcf",
    "#b7cd9e",
    "#82986b",
    "#ecf0d9",
    "#ceac9d",
    "#52634c",
  ],
];
export function Art({
  profile,
  scene = "room",
  care = false,
  progress = 0,
}: {
  profile: Profile;
  scene?: string;
  care?: boolean;
  progress?: number;
}) {
  const id = useId().replace(/:/g, ""),
    names = [
      "top",
      "bottom",
      "ear",
      "inner-ear",
      "paw",
      "outline",
      "belly",
      "blush",
      "ink",
    ];
  const style = Object.fromEntries(
    names.map((n, i) => [
      "--pet-" + n,
      palettes[profile.petColor]?.[i] || palettes[0][i],
    ]),
  ) as React.CSSProperties;
  function unique(svg: string) {
    return svg
      .replace(/id="([^"]+)"/g, (_, x) => `id="${id}-${x}"`)
      .replace(/url\(#([^)]+)\)/g, (_, x) => `url(#${id}-${x})`);
  }
  let pet = images.pet.replace(
    /<g id="petAccessory"><\/g>/,
    profile.accessory === "bow"
      ? '<path d="m94 48-17-14v28l17-9 17 9V34Z" fill="#b6879b" stroke="#8c6279" stroke-width="2"/><circle cx="95" cy="49" r="5" fill="#d4a8ba"/>'
      : profile.accessory === "star"
        ? '<path d="m113 25 5 12 14 1-11 9 3 14-11-8-12 8 4-14-11-9 14-1Z" fill="#e5c77c" stroke="#b79a59" stroke-width="2"/>'
        : "",
  );
  if (profile.accessory !== "leaf")
    pet = pet.replace(/<g class="pet-sprout">[\s\S]*?<\/g>/, "");
  return (
    <div
      className={"art " + scene + (care ? " loved" : "")}
      data-nest-theme={profile.environment}
      style={style}
    >
      <div
        className="backdrop"
        dangerouslySetInnerHTML={{
          __html: unique(images[scene as keyof typeof images] || images.room),
        }}
      />
      <div
        className="pet-art"
        style={
          scene === "park" ? { left: 25 + progress * 13 + "%" } : undefined
        }
        dangerouslySetInnerHTML={{ __html: unique(pet) }}
      />
      {care && <span className="hearts">♡</span>}
    </div>
  );
}
