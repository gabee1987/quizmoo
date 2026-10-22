# Event day checklist

One page for the host. Tick each item; the "if something goes wrong" section is for the day itself.

## The week before

- [ ] The quiz is ready and checked in the editor (the phone preview shows how answers look).
- [ ] Game settings are chosen on the quiz: individual or team mode (team names entered), when correct answers and the scoreboard are shown, and whether you release the final results yourself.
- [ ] A test game was played end to end with two phones and the projector screen.
- [ ] You know your host username and password. On the venue LAN, use an account whose password is not used anywhere else.

## At the venue, 30 minutes before

- [ ] The laptop is plugged in, sleep and screen saver are off.
- [ ] Wifi: phones and the laptop are on the same network, and it has no client isolation (guest networks often have it). A phone opening the app address shows the join page.
- [ ] Laptop setup only: the address in `APP_ORIGIN` is the laptop's current IP (`ipconfig`), then `docker compose up -d`.
- [ ] `<app address>/api/health` shows `"ok":true,"db":true`.
- [ ] Projector: open the game's host control, press **Open screen**, drag that window to the projector and make it full screen (F11). Text is readable from the back of the room.
- [ ] Log in to the host control on a laptop or phone you keep with you.

## Running the game

1. Create the game from the quiz (**Play**). Change settings for this game only if needed.
2. The projector shows the QR code, the address and the PIN. Players scan the code or type the PIN and a nickname.
3. When everyone is in, press **Start**. Each question closes when time is up or everyone has answered.
4. After each question: **Next question**, or **Show scoreboard** first (depending on the settings).
5. On the projector laptop, Space or → does the same as the main host button.
6. At the end: **Finish**. If final results are held, press **Show podium** for the projector and **Show results on phones** when you are ready.

## If something goes wrong

- **A phone lost connection or the page was closed:** reopen the same address on the same phone; the player rejoins with their score. Nothing to do on the host side.
- **A question needs more time:** press **+30 s**. To drop a question: **Skip** (nobody scores on it).
- **Unwanted nickname:** remove the player from the player list.
- **No projector:** run the game from the host control on the laptop. The QR code and PIN are on the host control in the lobby, and players see each question and its answers on their own phones; read the questions aloud.
- **The server or laptop restarted:** start it again (`docker compose up -d`). The game resumes where it was; phones reconnect by themselves within a few seconds.
- **The venue wifi fails:** players can switch to mobile data only if the app runs on a public (cloud) address. On a laptop-only setup, a travel router or phone hotspot that the laptop and the phones join is the fallback.

## After the event

- [ ] **Games** → the game → **Results**: check the podium and the questions, **Export CSV** if needed, **Show on screen** to present the summary.
- [ ] Delete games you do not need to keep. Finished games are deleted automatically after the retention period (90 days by default).
