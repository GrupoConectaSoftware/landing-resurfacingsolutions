import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import alpinejs from "@astrojs/alpinejs";
import icon from "astro-icon";

export default defineConfig({
    vite: {
        plugins: [tailwindcss()],
    },

    integrations: [alpinejs(), icon()],
});
