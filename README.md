<img width="1196" height="374" alt="StationPresets" src="https://github.com/user-attachments/assets/1171811b-686f-4632-ab2b-4d8258298757" />

# StationPresets

A plugin for [FM-DX Webserver](https://github.com/NoobishSVK/fm-dx-webserver) that adds a row of preset buttons to the interface, letting you jump to your saved stations with a single click.

---

## What it does

- Supports multiple banks of stations with no fixed limit on the number of presets per bank
- Displays each station's **name and frequency** on its button
- Optionally shows the station's **logo** on hover, fetched automatically using the RDS PI code
- Lets you **switch banks** directly from the interface
- Supports **keyboard navigation** - press `[` and `]` to step through stations one by one
- Automatically **highlights** the button matching the currently tuned frequency
- Supports **antenna switching** per preset

---

## Setup

1. Place `StationPresets.js` inside your `plugins` folder
2. Restart the webserver, go to Settings -> Plugins and enable StationPresets.
3. Open the file and fill in your stations in the `BANKS` section at the top

Each station follows this format:
```
"COUNTRY/PI CODE/FREQUENCY/NAME/ant''"
```

**Example:**
```
"POL/3399/104.1/RMF MAXX/ant'1'"
```

- `COUNTRY` - two or three letter ISO country code (e.g., POL, DEU, CZE)
- `PI CODE` - the station's RDS PI code in hex - used to find its logo automatically. Leave empty if unknown
- `FREQUENCY` - in MHz
- `NAME` - the label shown on the button
- `ant''` - which antenna to switch to when selecting this preset (0–3). Leave empty to keep the current antenna

---

## Managing Banks

<img width="355" height="224" alt="bank" src="https://github.com/user-attachments/assets/9a450f1d-bb8a-45eb-bb8e-314f3a92c3cd" />

The plugin supports multiple banks (A, B, C, D by default). You can add new banks or remove existing ones by modifying the BANKS object.
Example of a bank structure:
```javascript
B: { stations: [
    "POL/326E/88.1/Koszalin/ant'0'",
    "POL/3489/89.0/R.WLKP/ant'0'",
    "POL/3169/89.7/PLANETA/ant'1'",
    // ... add as many as you need
]},
```
To remove a bank, simply delete its entire block (from B: { to ]},). To add a new one, copy an existing block and give it a new letter or name.

---

## Options

At the top of the file you can toggle a few things on or off:

| Option | What it does |
|---|---|
| `SHOW_LOGOS` | Show station logo inside the button |
| `SHOW_HOVER_LOGO` | Show station logo when hovering over a button |
| `SHOW_HOVER_LABEL` | Show station name when hovering over a button |
| `SHOW_BANK_BUTTONS` | Show the bank selector row (A / B / C / D) |
| `EXTRA_DROPDOWN` | Add a bank selector dropdown next to a specific control (`ims`, `bw`, `ant`, or `none`) |

---

## Logos

Logos are fetched automatically from [tef.noobish.eu/logos](https://tef.noobish.eu/logos) using the PI code you provide. Once loaded, each logo is remembered for 7 days so it doesn't need to be fetched again.

You can also use your own local logos by setting the country to `local` — the plugin will then look for the image in the `web/logos/` folder on your server.

---

## Credits

Inspired by [FM-DX-Webserver-Plugin-Button-Presets](https://github.com/AmateurAudioDude/FM-DX-Webserver-Plugin-Button-Presets) by AmateurAudioDude.
Logo images provided by [tef.noobish.eu](https://tef.noobish.eu/logos).

> **Note:** This plugin's code was developed with the assistance of AI.
