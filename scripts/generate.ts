import type { Palette } from "./palettes";
import type { IconDefinitions } from "~/types";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, parse } from "node:path";
import { TinyColor } from "@ctrl/tinycolor";
import { IconVariant } from "~/constants";
import { createTheme } from "~/themes";
import { basePalette, lightPalette, softPalette } from "./palettes";

const iconFilenames = await readdir("icons");

function replaceSvgColors(content: string, palette: Partial<Palette>): string {
    for (const [key, value] of Object.entries(basePalette)) {
        if (content.includes(value) && key in palette) {
            content = content.replaceAll(value, palette[key as keyof Palette]!);
        }
    }
    return content;
}

async function applyPalette(variant: IconVariant, palette: Partial<Palette>) {
    return Promise.all(
        iconFilenames.map(async (filename) => {
            const content = await readFile(
                join("dist", "themes", variant, "icons", filename),
                "utf-8",
            );
            const modified = replaceSvgColors(content, palette);

            await writeFile(
                join("dist", "themes", variant, "icons", filename),
                modified,
                "utf-8",
            );
        }),
    );
}

async function generateIconVariant(
    variant: IconVariant,
    palette: Partial<Palette>,
) {
    await rm(join("dist", "themes", variant), { recursive: true, force: true });
    await mkdir(join("dist", "themes", variant, "icons"), { recursive: true });
    await cp("icons", join("dist", "themes", variant, "icons"), {
        recursive: true,
    });

    await applyPalette(variant, palette);
}

async function createThemeFiles() {
    /** VSCODE:
	const iconDefinitions = iconFilenames.reduce<IconDefinitions>((acc, filename) => {
		acc[parse(filename).name] = { iconPath: `./icons/${filename}` };
		return acc;
	}, {});
	const iconDefinitionsJson = JSON.stringify(iconDefinitions);
	const baseThemeJson = JSON.stringify(createTheme({}, iconDefinitions));

	for (const variant of Object.values(IconVariant)) {
		await writeFile(join("dist", "themes", variant, "iconDefinitions.json"), iconDefinitionsJson, "utf-8");
		await writeFile(join("dist", "themes", variant, "theme.json"), baseThemeJson, "utf-8"); Not needed for zed
	}
	*/
    /* For Zed we need to update icon_themes/charmed-icons-theme.json to reference the new theme */
    for (const variant of Object.values(IconVariant)) {
        const path = join("dist", "themes", variant);

        const iconDefinitions = iconFilenames.reduce<IconDefinitions>(
            (acc, filename) => {
                if (filename.startsWith("folder") || filename.startsWith("_"))
                    return acc;

                acc[parse(filename).name] = {
                    path: join(path, "icons", filename),
                };
                return acc;
            },
            {},
        );

        const themeType = `${variant}`;
        const themeData = {
            $schema: "https://zed.dev/schema/icon_themes/v0.2.0.json",
            name: "Charmed Icons",
            author: "littensy",
            themes: [
                {
                    name: `${
                        themeType.charAt(0).toUpperCase() + themeType.slice(1)
                    } Charmed Icons`,
                    appearance: "dark",
                    directory_icons: {
                        collapsed: `${join(path, "_folder.svg")}`,
                        expanded: `${join(path, "_folder_open.svg")}`,
                    },
                    file_stems: {},
                    file_suffixes: {},
                    file_icons: iconDefinitions,
                },
            ],
        };

        const outputPath = join("icon_themes", `${variant}-icon-theme.json`);
        writeFile(outputPath, JSON.stringify(themeData, null, 2));
    }
}

function createPalette(colorProcessor: (color: string) => string) {
    return Object.entries(basePalette).reduce<Partial<Palette>>(
        (acc, [key, value]) => {
            acc[key as keyof Palette] = colorProcessor(value);
            return acc;
        },
        {},
    );
}

await Promise.all([
    generateIconVariant(IconVariant.Base, basePalette),
    generateIconVariant(IconVariant.Light, lightPalette),
    generateIconVariant(IconVariant.Soft, softPalette),
    generateIconVariant(
        IconVariant.Warm,
        createPalette((color) => {
            return new TinyColor(color).mix("#ff4400", 7).toHexString();
        }),
    ),
]);

await createThemeFiles();
