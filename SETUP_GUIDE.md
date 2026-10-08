# LMT Places Simulator v2 — Setup Guide

Plain HTML / CSS / JavaScript. No build step and no hosting required.

## Files

| File | What it is |
|---|---|
| `index.html` | The page. Open it in Chrome or Edge. |
| `style.css` | All styling. |
| `data.js` | The 50 built-in cases (Day 1–5), parent geos, brands, reasons. |
| `script.js` | All logic. **Settings are at the very top (`APP_CONFIG`).** |
| `Code.gs` | Google Apps Script that saves results, questions, waves and sessions into your Google Sheet. |
| `LMT_Question_Template.xlsx` | The template for adding your own questions (Guidelines + Questions + Lists sheets). |
| `LMT_Answer_Key_and_Hotel_List.xlsx` | Trainer answer key for the 50 built-in cases, with the source link for each real hotel. |

Keep the four web files in the same folder.

## 1 · Run it (works offline straight away)

Double-click `index.html`. Results are stored in that browser until a Google Sheet is connected.

Admin password: **`Trainor123Password`**

## 2 · Connect Google Sheets (all agents' results in one place)

1. Create a Google Sheet, then **Extensions → Apps Script**. Paste all of `Code.gs`, Save.
2. Pick **`setup`** in the function dropdown → **Run** → allow permissions.
   This creates the tabs: Results, Question_Log, Trainers, Countries, Waves, Sessions, Questions, Builtin_Status, Admin_Audit.
3. **Deploy → New deployment → ⚙ → Web app** → Execute as **Me**, Who has access **Anyone** → Deploy → copy the URL ending in **`/exec`**.
   (This only gives the Sheet an address the HTML can send results to. The simulator itself stays your HTML files.)
4. Paste that URL in `script.js` → `WEB_APP_URL: '…/exec'`. Or, without editing code: Admin Portal → ⚙ Settings → paste → **Test connection** → Save (that browser only).

After any later edit to `Code.gs`, go to **Deploy → Manage deployments → ✏ → Version: New version → Deploy**. The URL stays the same.

Forgot the admin password? In the Apps Script editor, run **`resetAdminPassword`**. It goes back to `Trainor123Password`.

## 3 · How agents play

- Log in, read the mission briefing, then work **10 cases per day**.
- Each case is one LMT request page that **scrolls top to bottom**:
  Basic Info → Provider Link → Contact / Description / Photos → Accommodation / Location Votes / Commerce Links → Geo Coding.
- **Research happens in their own Chrome.** "Helpful Links" opens Google, Google Maps, Tripadvisor, Facebook and Instagram searches in new tabs. "Open Provider Page in New Tab" opens what the feed sent.
- Apply Basic Info, Contact, Accommodation and Geo. Then take the action: ✔ Approve · ⊗ Reject · ⬆ Tier 1/Tier 2 · ⏱ Defer, or **Add name as alias**.
  For Alias, agents paste the existing Tripadvisor listing link.
- Each case gets field-by-field feedback. The day ends with a scorecard (XP, level, badges), saved to the Sheet.

## 4 · Admin Portal

| Tab | What it does |
|---|---|
| 📊 Results | Filter by trainer, wave, day, country, pass/fail or date. Click a row for the 10 answers and notes. Export CSV. |
| 📝 Questions | See the question bank. Add questions manually, download the template (Excel or CSV), upload a filled template, or export the whole bank to edit. Switch any question On or Off. |
| 🧩 Case Analytics | Action accuracy per case across all agents. |
| 🏅 Leaderboard | Total XP and best score per day. |
| 🗓️ Sessions & Waves | Create sessions and waves. **Type the trainer's name**; new names are saved to the trainer list automatically. |
| 👥 Trainers & Countries | Edit the login dropdowns. |
| ⚙️ Settings | Sheet URL, sync, change password, clear browser data. |

## 5 · Adding your own questions

1. Admin → Questions → **Excel template** (or use `LMT_Question_Template.xlsx`).
2. Read the **Guidelines** sheet. Then fill one row per hotel in **Questions**.
3. Admin → Questions → **Upload filled template**. The preview lists every row with errors before anything is saved.

Rules in short:
- An **empty** cell is not scored.
- **BLANK** means the agent must leave that field empty.
- Separate several accepted answers with **` | `**.
- Days **6–10** are free for your own sets. Tick them on a Wave so agents can choose them.
- Re-using a built-in Case ID (e.g. `D2-05`) replaces that built-in case.
- To edit built-ins: **Export question bank** → edit → upload.

## 6 · About the built-in hotels

- **30 Approve cases** are real homestays registered with Kerala Tourism. The answers come from their keralatourism.org listings (checked Oct 2026); the links are in the answer key.
  - Before each wave, search each one on tripadvisor.com.
  - If one has since been listed, switch it Off, or change it to an Alias case.
  - Phone numbers and websites can change, so re-check them too.
- **5 Alias cases** are well-known hotels already on Tripadvisor. Any Tripadvisor listing link is accepted. To require the exact listing, paste its URL into "Existing Tripadvisor Listing" for that case.
- **5 Not-an-accommodation cases** are real places with no guest rooms (museum, cultural centre, restaurant, amusement park).
- **10 Unverifiable / Tier 2 cases** use invented names on purpose. All the evidence (scam reports, owner disputes, safety notices) is inside LMT. No real business is named in a fraud or safety scenario.

## Notes

- The map uses Leaflet + OpenStreetMap from the internet. If they are blocked, agents type the coordinates instead; scoring still works.
- The Excel template download/upload uses the SheetJS library from the internet. If it is blocked, use the CSV template; upload works the same.
- Pop-ups must be allowed for the provider page to open in a new tab.
