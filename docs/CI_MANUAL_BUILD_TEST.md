# 🔨 Manual Build and Test Workflow

Dokumentasi untuk menjalankan manual build workflow dengan pemilihan branch di GitHub Actions.

---

## 📋 Overview

Workflow ini memungkinkan Anda untuk:
- ✅ Build aplikasi secara manual dari branch yang dipilih
- ✅ Menjalankan type checking TypeScript
- ✅ Memverifikasi output build
- ✅ Menyimpan build artifacts (opsional)

---

## 🚀 Cara Menggunakan

### Metode 1: Via GitHub Web Interface

1. **Buka GitHub Repository**
   - Navigasi ke repository Anda di GitHub

2. **Masuk ke Actions Tab**
   - Klik tab **"Actions"** di bagian atas repository

3. **Pilih Workflow**
   - Di sidebar kiri, cari dan klik **"Manual Build and Test"**

4. **Run Workflow**
   - Klik tombol **"Run workflow"** (di kanan atas)
   - Akan muncul dropdown menu

5. **Pilih Branch**
   - Pada field **"Select branch to build"**, masukkan nama branch yang ingin di-build
   - Default: `main`
   - Contoh lain: `development`, `feature/new-feature`, `hotfix/bug-fix`

6. **Pilih Auto Release** (Opsional)
   - Pada field **"Automatically create release after successful build"**
   - Default: `true` (enabled)
   - ✅ **Jika enabled**: Setelah build berhasil di branch `main`, otomatis trigger release ke GitHub Releases
   - ❌ **Jika disabled**: Hanya build saja, tidak create release

7. **Jalankan**
   - Klik tombol hijau **"Run workflow"**

8. **Monitor Progress**
   - Workflow akan mulai berjalan
   - Klik pada workflow run untuk melihat detail progress
   - Anda dapat melihat logs real-time untuk setiap step
   - **Jika auto_release enabled dan branch = main**: Setelah build selesai, akan otomatis trigger workflow "Auto Release to GitHub"

### Metode 2: Via GitHub CLI

Jika Anda memiliki [GitHub CLI](https://cli.github.com/) terinstall:

```bash
# Run workflow pada branch main
gh workflow run "Manual Build and Test" --field branch=main

# Run workflow pada branch lain
gh workflow run "Manual Build and Test" --field branch=development

# List running workflows
gh run list --workflow="Manual Build and Test"

# Watch workflow progress
gh run watch
```

---

## 📊 Workflow Steps

Workflow ini menjalankan langkah-langkah berikut:

### 1. **Checkout Repository**
   - Meng-checkout kode dari branch yang dipilih
   - Menggunakan commit terbaru dari branch tersebut

### 2. **Setup Node.js**
   - Install Node.js v20 (LTS)
   - Setup npm cache untuk instalasi lebih cepat

### 3. **Display Branch Info**
   - Menampilkan informasi branch yang sedang di-build
   - Menampilkan commit hash dan message

### 4. **Install Dependencies**
   - Menjalankan `npm ci` untuk clean install
   - Menggunakan `package-lock.json` untuk versi konsisten

### 5. **Run Type Check**
   - Menjalankan `npm run type-check`
   - Memverifikasi tidak ada error TypeScript

### 6. **Build Application**
   - Menjalankan `npm run build`
   - Mengcompile TypeScript ke JavaScript
   - Output ke folder `dist/`

### 7. **Verify Build Output**
   - Memverifikasi file hasil build ada di `dist/`
   - Menampilkan list file yang ter-generate

### 8. **Upload Build Artifacts**
   - Menyimpan hasil build sebagai artifact
   - Artifact tersimpan selama 7 hari
   - Dapat di-download untuk testing atau deployment

### 9. **Trigger Auto Release** (Conditional)
   - **Hanya berjalan jika**:
     - Branch yang di-build adalah `main`
     - Option `auto_release` diset `true`
   - Memanggil workflow **"Auto Release to GitHub"**
   - Membuat GitHub Release dengan:
     - Production bundle (tar.gz & zip)
     - Changelog dari dokumentasi
     - Tag sesuai version di `package.json`

---

## ✅ Expected Output

Jika workflow berhasil, Anda akan melihat:

**Build Job:**
```
✓ Checkout repository
✓ Setup Node.js
✓ Display branch info
✓ Install dependencies
✓ Run type check
✓ Build application
✓ Verify build output
✓ Upload build artifacts
```

**Release Job (jika auto_release enabled & branch = main):**
```
✓ Check version
✓ Build application
✓ Prepare production bundle
✓ Create release archive
✓ Get latest changelog
✓ Create GitHub Release
✓ Upload artifacts to release
```

**Artifact yang tersimpan:**
- Nama: `build-<branch>-<run_number>`
- Contoh: `build-main-42`
- Isi: Folder `dist/` lengkap dengan semua compiled files

---

## 📥 Download Build Artifacts

### Via GitHub Web Interface

1. Masuk ke workflow run yang sudah selesai
2. Scroll ke bawah ke section **"Artifacts"**
3. Klik nama artifact untuk download (format .zip)
4. Extract file zip untuk mendapatkan folder `dist/`

### Via GitHub CLI

```bash
# List artifacts dari workflow run terbaru
gh run view --log

# Download artifact
gh run download <run-id>

# Download artifact dari run terbaru
gh run download
```

---

## 🐛 Troubleshooting

### Build Failed - Dependency Error

**Error:**
```
npm ERR! code ENOENT
npm ERR! syscall open
```

**Solution:**
- Pastikan `package.json` dan `package-lock.json` ada di repository
- Commit dan push file tersebut jika belum ada

---

### Build Failed - TypeScript Error

**Error:**
```
error TS2322: Type 'string' is not assignable to type 'number'
```

**Solution:**
- Fix TypeScript error di kode Anda
- Jalankan `npm run type-check` secara lokal untuk testing
- Commit dan push fix

---

### Build Failed - Build Script Error

**Error:**
```
npm ERR! Missing script: "build"
```

**Solution:**
- Pastikan `package.json` memiliki script `build`
- Contoh:
  ```json
  {
    "scripts": {
      "build": "node scripts/build-clean.js"
    }
  }
  ```

---

### Workflow Tidak Muncul di Actions

**Solution:**
- Pastikan file workflow ada di `.github/workflows/`
- Pastikan file berekstensi `.yml` atau `.yaml`
- Push file workflow ke branch default (main/master)
- Refresh halaman GitHub Actions

---

### Branch Tidak Ditemukan

**Error:**
```
Error: Cannot find branch 'xyz'
```

**Solution:**
- Pastikan branch name ditulis dengan benar (case-sensitive)
- Pastikan branch sudah di-push ke GitHub
- Gunakan `git branch -a` untuk list semua branch

---

## 📋 Use Cases

### 1. **Build and Release to Production**
```
Skenario: Siap untuk production release
Action: 
- Run workflow dengan branch: main
- Enable auto_release: true
Result: Build selesai → Otomatis create GitHub Release
```

### 2. **Testing Before Merge**
```
Skenario: Anda ingin test build pada feature branch sebelum merge
Action: 
- Run workflow dengan branch: feature/new-feature
- Disable auto_release (tidak perlu release untuk testing)
Result: Build terverifikasi tanpa create release
```

### 3. **Verifikasi Hotfix**
```
Skenario: Anda perlu verify hotfix branch dapat di-build dengan sukses
Action: 
- Run workflow dengan branch: hotfix/critical-bug
- Disable auto_release
Result: Build terverifikasi sebelum merge ke main
```

### 4. **Build untuk Testing Manual**
```
Skenario: QA perlu build terbaru untuk testing manual
Action: 
- Run workflow dengan branch yang sesuai
- Download artifacts
- Deploy ke testing environment
```

### 5. **Build Only (No Release)**
```
Skenario: Ingin build di main branch tapi belum siap release
Action: 
- Run workflow dengan branch: main
- Disable auto_release: false
Result: Build saja tanpa create release
```

---

## 🔍 Advanced: Modify Workflow

Untuk customize workflow, edit file:
```
.github/workflows/manual-build-test.yml
```

### Contoh Modifikasi:

**Tambah Testing Step:**
```yaml
- name: Run tests
  run: npm test
```

**Gunakan Node.js versi lain:**
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '18'  # Ganti ke v18
```

**Simpan artifacts lebih lama:**
```yaml
- name: Upload build artifacts
  uses: actions/upload-artifact@v4
  with:
    name: build-${{ github.event.inputs.branch }}
    path: dist/
    retention-days: 30  # Simpan 30 hari
```

---

## 📞 Support

Jika mengalami masalah:
1. ✅ Check logs workflow di GitHub Actions
2. ✅ Verify semua dependencies ter-install
3. ✅ Pastikan branch name benar
4. ✅ Test build secara lokal dengan `npm run build`

---

**Happy Building! 🎉**
