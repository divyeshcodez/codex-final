# VerifyOnce

A mobile-first demonstration of shared identity verification across government portals.

## Features

- Ration Card Portal document verification with a realistic loading state
- Shared in-browser verification vault
- Scholarship Portal reuses an existing verification by phone number
- Explicit consent log for every identity reuse
- Seeded citizen: Meera Patel, `9876543210`
- OTP-based mobile verification (demo OTP: `123456`)
- Consent decision screen with minimum-data sharing
- Verification validity period and re-verification-ready status
- Hindi toggle, CSC-assisted mode, and offline queue simulation
- DigiLocker/API Setu integration-ready demo handoff (requires approved production credentials)

## Run locally

Open `index.html` in a browser, or serve the folder with any static web server.

## Deploy to Vercel

This is a static site with no build step. Import the GitHub repository in Vercel and choose the framework preset **Other**. Leave the build command empty and use the repository root as the output directory.
