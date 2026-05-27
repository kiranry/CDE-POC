# Git setup — personal repo only (this project)

Your **global** git uses work identity (`kiran.ravindran@qburst.com`).  
This folder has its **own** git repo with **local** config — it does not change global settings.

---

## 1. Set your personal identity (this repo only)

```bash
cd /home/kiran/Desktop/CDE_VISL

git config --local user.name "Your Personal Name"
git config --local user.email "your-personal@gmail.com"
```

Verify (should show personal, not work):

```bash
git config --local user.name
git config --local user.email
```

---

## 2. Connect to your GitHub repo

Replace with your real URL from GitHub → **Code** button:

**HTTPS:**

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

**SSH (if your personal GitHub uses SSH keys):**

```bash
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO.git
```

---

## 3. First push

```bash
git add .
git status   # should only show CDE_VISL files, not Desktop/other projects
git commit -m "Initial commit: PRHUB CDE POC"
git branch -M main
git push -u origin main
```

If GitHub repo already has a README (created on github.com), either:

```bash
git pull origin main --rebase
git push -u origin main
```

or delete the remote README on GitHub and push again.

---

## 4. Auth tips

| Method | Note |
|--------|------|
| **HTTPS** | Use a [Personal Access Token](https://github.com/settings/tokens) as password, not your GitHub password |
| **SSH** | Use `ssh -T git@github.com` — should greet your **personal** account |

To force SSH for github.com only (personal key in `~/.ssh/id_ed25519_personal`):

```bash
# ~/.ssh/config
Host github.com-personal
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_personal

# Then remote:
git remote set-url origin git@github.com-personal:YOUR_USERNAME/YOUR_REPO.git
```

---

## 5. After push → Plan B deploy

Continue with **`DEPLOYMENT-PLAN-B.md`**: Neon → R2 → Vercel → cron-job.org.

---

## Do not use the parent Desktop git repo

Do **not** run `git add` from `/home/kiran/Desktop` — that mixes work projects.  
Always `cd` into **`CDE_VISL`** first.
