# Video Hub (Render + Google Cloud Storage)

Video upload website. Browser theke video **shorashori Google Cloud Storage (GCS) e** jay, Render server shudhu temporary upload link ar video list dey. Tai Render er free plan e-o boro video upload kora jay.

```
Browser --(1) upload link chai--> Render server (Node.js)
Browser --(2) video PUT--------> Google Cloud Storage
Browser --(3) title save koro--> Render server
```

---

## Step 1: Google Cloud te bucket ar key banano

1. https://console.cloud.google.com e jao, ekta project banao (ba existing ta use koro).
2. **Cloud Storage > Buckets > Create**
   - Naam dao (jemon `amar-video-hub-123`), eta tomar `GCS_BUCKET`
   - Region: `us-central1` ba `us-east1` ba `us-west1` (free tier ei region gulo te pawa jay, Google er current pricing page e ekbar dekhe nio)
   - "Enforce public access prevention" **on** rakho, Access control: **Uniform**
3. **IAM & Admin > Service Accounts > Create service account**
   - Naam: `video-hub`
   - Role: **Storage Object Admin**
4. Service account e click > **Keys > Add key > Create new key > JSON**. Ekta `.json` file download hobe. Eta ekta password er moto, kauke dibe na, GitHub e upload korbe na.

## Step 2: Bucket e CORS set kora (browser theke upload er jonno must)

Console er upore dan dike **Cloud Shell** (`>_` icon) e click koro. Terminal khulbe. Seikhane eta paste koro (`BUCKET_NAME` er jayga nijer bucket er naam dao):

```
cat > cors.json <<'EOF'
[{"origin":["*"],"method":["PUT","GET","HEAD"],"responseHeader":["Content-Type"],"maxAgeSeconds":3600}]
EOF
gcloud storage buckets update gs://BUCKET_NAME --cors-file=cors.json
```

(Pore chaile `"*"` er jayga nijer Render URL dite paro, jemon `https://video-hub.onrender.com`)

## Step 3: Code GitHub e rakho

1. https://github.com e notun repository banao (naam: `video-hub`).
2. **Add file > Upload files** diye ei folder er file gulo upload koro: `server.js`, `package.json`, `public/index.html`, `README.md`, `.gitignore`, `.env.example`, `cors.json`.
   - **Key `.json` file ar `.env` upload korba na.**
3. Commit koro.

## Step 4: Render e deploy

1. https://render.com e GitHub diye sign up koro.
2. **New > Web Service** > tomar `video-hub` repo select koro.
3. Settings:
   - **Runtime / Language:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. **Environment Variables** e 3 ta add koro:

   | Name | Value |
   |---|---|
   | `GCS_BUCKET` | tomar bucket er naam |
   | `APP_PASSWORD` | upload er jonno ekta shokto password |
   | `GCS_CREDENTIALS_JSON` | Step 1 er key file ta text editor (Notepad) e khule **puro content copy kore paste** |

5. **Create Web Service** e click koro. Kichukkhon por Render ekta link dibe (`https://...onrender.com`). Oi link e gele website dekhte pabe.

## Step 5: Test

Website e jao, ekta chhoto video select koro, password dao, Upload click koro. Hoye gele nicher list e video dekha jabe.

---

## Shomossha hole

| Ki hocche | Karon |
|---|---|
| "Network/CORS error" ba "upload fail (403)" | Step 2 (CORS) hoy nai ba bucket er naam bhul |
| "Password thik na" | `APP_PASSWORD` Render e ja diyecho seta dao |
| Render e deploy fail, log e `GCS_CREDENTIALS_JSON valid JSON na` | Key file er puro content paste hoy nai |
| Prothom bar page khulte onek time lage | Render free plan e kichukkhon use na korle server ghumiye jay, ~30-60 second lage jagte |
| Video list khali ba error | Service account e **Storage Object Admin** role deya ache kina dekho |

## Khoroch niye

- GCS e ekta free limit ache, kintu tar beshi storage ba download hole taka lage. Google Cloud er **Billing > Budgets & alerts** e ekta chhoto budget alert (jemon $1) set kore rakho.
- `APP_PASSWORD` ache bole shudhu tumi upload korte parbe. Video dekhar link jeta page e ashe seta shobai dekhte pabe jar kache website er URL ache.

## Nijer computer e chalate chaile

```
npm install
cp .env.example .env    # tarpor .env e bucket, password, key file path boshao
npm start
```
Tarpor http://localhost:3000
