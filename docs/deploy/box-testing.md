# Testing the Odr Box

Written for whoever runs the Box on a real machine for the first time. The Box is
one file: the Odr API, the staff app and the database, running on a restaurant's own
computer with no internet. This guide takes about 30 minutes per platform.

What you need: the binary for the platform (see "Building" below), a phone on the same
wifi as the test machine, and, if you have one, a network thermal printer.

---

## Building the binaries

On the Mac, from the repo root on branch `box`:

```bash
bun run build:box                    # this Mac            → apps/box/dist/odr-box-host
bun run build:box bun-windows-x64    # Windows 10/11 64-bit → apps/box/dist/odr-box-bun-windows-x64.exe
bun run build:box bun-linux-x64      # Linux PC / mini PC   → apps/box/dist/odr-box-bun-linux-x64
bun run build:box bun-linux-arm64    # Raspberry Pi 4/5     → apps/box/dist/odr-box-bun-linux-arm64
```

Each build takes two to four minutes and the files are 80 to 140 MB. Every build
also rebuilds the staff app, so `apps/captain-pwa/dist` is left in its Box form
(no diner origin). Run `bun run build:captain` again before a cloud deploy.

Windows executables built here show a black console window when run. That is expected
until the installer work; closing that window stops the Box.

---

## The same test on every platform

Whatever the machine, the walk-through is identical once the Box is running.

1. **Read the console.** It prints the data folder, the address for this computer
   (`http://localhost:7777`), the address a phone must type (`http://<wifi ip>:7777`),
   and, until setup is done, the six-digit first-time setup code. Write the code down;
   it changes on every restart, and it stops appearing once the restaurant exists.
2. **Open the address in a browser on the same machine.** You should see the Odr sign-in
   screen with a "Set up this restaurant" form instead of the login fields.
3. **Set up.** Restaurant name, GSTIN (optional), your name, email, a password of eight
   or more characters, and the setup code. Try a wrong code once first: it must be
   refused with "wrong setup code". Then the right one. You land signed in as owner.
4. **Settings → Tables.** Add "Table 1 to Table 4". They appear on the Tables screen.
5. **Take an order.** Open Table 1, add two items, Fire KOT. The Kitchen tab shows the
   ticket with "Table 1" as its heading.
6. **Settle.** Settle & bill, print the bill from the browser's print dialog (save as
   PDF is fine). The Sales tab shows the bill.
7. **Check the offline hiding.** More has no "Print QR sheet" row. Settings has no
   "Table QR codes" section. Branding has no font picker. Typing `#/qr` in the address
   bar lands on Tables.
8. **From a phone.** Open the "On a phone on this wifi" address printed in the console,
   for example `http://192.168.1.23:7777`. Never `localhost` — that is the phone itself. Sign in, open a table, fire a KOT. The Kitchen tab on
   the computer shows it within five seconds.
9. **Restart.** Stop the Box (Ctrl+C in the console, or close the window on Windows)
   and start it again. Sign in. Tables, the order and the bill are all still there, and
   setup is no longer offered.
10. **Printer, if you have one.** Settings → Printing, enter the printer's IP, save,
    and use the kitchen-printer button on a bill. Browser print needs no setup.

If any step fails, jump to "When something goes wrong" at the end.

---

## macOS (developer machine)

```bash
ODR_DATA=/tmp/odr-test ODR_PORT=7777 ./apps/box/dist/odr-box-host
```

- `ODR_DATA` keeps the test data out of your real `~/Odr`. Delete the folder to reset.
- Gatekeeper may refuse the first launch of the built file. Right-click → Open once,
  or run `xattr -d com.apple.quarantine apps/box/dist/odr-box-host` if it was copied
  from another machine. A file built on this Mac usually runs without either.
- Wifi IP for the phone step: System Settings → Wi-Fi → Details, or
  `ipconfig getifaddr en0`.
- macOS may ask "allow incoming connections" on first start. Allow.

## Windows 10 / 11

1. Copy `odr-box-bun-windows-x64.exe` to the PC (USB stick, or a shared folder).
   Put it in a folder of its own, for example `C:\Odr\`.
2. Double-click it. SmartScreen shows "Windows protected your PC" because the file is
   not signed yet: click **More info → Run anyway**. Some antivirus products quarantine
   unsigned single-file executables on sight; if the file vanishes, restore it from
   the antivirus history and add the folder as an exception. Signing removes both
   warnings and is on the installer plan.
3. The Windows Firewall prompt appears on first start. Tick **Private networks** and
   Allow. Without this the phones cannot connect.
4. The console shows the address and the setup code. Data goes to
   `C:\Users\<name>\Odr`. To use another folder, start from a command prompt:
   `set ODR_DATA=D:\OdrData && odr-box-bun-windows-x64.exe`.
5. Wifi IP for the phone step: `ipconfig` in a command prompt, the "IPv4 Address" under
   the Wi-Fi adapter.
6. To stop: close the console window, or Ctrl+C in it.

Things to watch for on Windows specifically:

- The PC must not sleep. Settings → System → Power → Screen and sleep → Never, for the
  test at least.
- If the phone cannot connect but the browser on the PC can, it is the firewall: run
  `wf.msc`, find the rule for the exe, make sure it allows the Private profile, and
  check the wifi network itself is marked Private, not Public.
- Windows Update may reboot the PC overnight; note whether the Box was still running
  in the morning. The installer plan adds start-on-boot.

## Linux PC or mini PC (x64)

```bash
chmod +x odr-box-bun-linux-x64
ODR_DATA=$HOME/Odr ./odr-box-bun-linux-x64
```

- Wifi IP: `hostname -I`.
- Firewall: on Ubuntu, `sudo ufw allow 7777/tcp` if ufw is active.
- To keep it running after you log out, for the test only:
  `nohup ./odr-box-bun-linux-x64 > odr.log 2>&1 &`. The setup code is then in
  `odr.log`. The installer plan replaces this with a systemd service.

## Raspberry Pi 4 or 5 (arm64)

Use the 64-bit Raspberry Pi OS. The 32-bit image will not run the binary.

```bash
scp apps/box/dist/odr-box-bun-linux-arm64 pi@<pi-ip>:~/odr-box
ssh pi@<pi-ip>
chmod +x ~/odr-box && ODR_DATA=$HOME/Odr ~/odr-box
```

- First start takes longer than on a PC (the database compiles its WebAssembly once);
  allow ten seconds before the console lines appear.
- Wifi IP: `hostname -I`. The phone step uses the Pi's address; the "computer browser"
  steps can be done from any laptop on the wifi instead of on the Pi itself.
- This is the one platform where PGlite has been built but never run before. If the
  Box fails to start with a message mentioning WebAssembly or `initdb`, stop and report
  the exact message: it decides whether the Pi is a supported Box.

---

## Record the result

For each platform note: build date and binary size, machine and OS version, and a
yes/no per step 1 to 10 with the exact message for any failure. Add the outcome to the
"Risks" section of `docs/superpowers/specs/2026-09-05-odr-box-offline-design.md`
(the PGlite bullet says which platforms have been exercised).

---

## When something goes wrong

**The console says "Odr Box could not start".** The next line says why. Either the data
folder is not writable (choose another with `ODR_DATA`) or port 7777 is taken (choose
another with `ODR_PORT`, and use it in the address).

**Wrong setup code five times.** Setup locks until the Box restarts. Restart it; a new
code is printed.

**The setup form disappears and the sign-in screen appears.** Someone else completed
setup first, or you reused a data folder: the page reloads on its own when the Box says
it is already set up. Sign in, or delete the data folder to start over.

**The phone shows nothing or times out.** Same wifi? Firewall allowed? Try the address
in the computer's own browser first. If that works and the phone does not, it is the
firewall or the network is marked Public (Windows).

**A screen looks stale after rebuilding the binary.** It cannot be the browser cache:
the page is served with no-store. Check you started the new file, not an old copy.

**Reset everything.** Stop the Box and delete the data folder. The next start is a
fresh first run. The folder holds `db/` (the database), `migrations/` (unpacked on
every start) and `secret` (the login signing key, created once).

**Automated checks** from the repo root: `bun test apps/box packages/db` boots a real
Box over HTTP and proves a failed boot releases the database. `bun run typecheck` and
`bun test` cover the whole repo.
