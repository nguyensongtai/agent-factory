# Xưởng Agent

Trung tâm điều hành các phiên [Claude Code](https://claude.com/claude-code) chạy trên máy của bạn, giao diện pixel-art
và sci-fi. Mỗi phiên là một agent đi lại giữa 8 khu của nhà máy theo công cụ nó đang dùng. Bên cạnh bản đồ là
dashboard (token, chi phí ước tính, độ trễ, lỗi), quản lý agent, Mission Control và trang giám sát.

Ứng dụng **chỉ đọc** transcript Claude Code trên chính máy đang chạy nó. Không cần tài khoản, API key hay cơ sở dữ
liệu, và không gửi dữ liệu đi đâu.

## Yêu cầu

| | |
|---|---|
| Node.js | **≥ 20.9** (khuyên dùng 22 LTS, có sẵn file `.nvmrc`) |
| npm | đi kèm Node |
| Claude Code | đã chạy ít nhất một lần trên máy này, để có transcript trong `~/.claude/projects` |
| Hệ điều hành | macOS, Linux hoặc Windows |

Kiểm tra nhanh:

```bash
node -v
```

```bash
ls ~/.claude/projects
```

## Cài đặt và chạy

```bash
git clone https://github.com/nguyensongtai/agent-factory.git
```

```bash
cd agent-factory
```

Nếu dùng [nvm](https://github.com/nvm-sh/nvm), chạy lệnh này để chọn đúng phiên bản Node:

```bash
nvm use
```

```bash
npm ci
```

```bash
npm run dev
```

Mở **http://127.0.0.1:4317**. Phiên Claude Code nào có hoạt động trong 3 giờ gần nhất sẽ hiện trên bản đồ. Mở một
phiên Claude Code ở terminal khác để thấy agent xuất hiện và đi lại.

### Chạy bản production

Bản production nhẹ và nhanh hơn, phù hợp khi muốn để dashboard chạy suốt.

```bash
npm run build
```

```bash
npm start
```

Server vẫn ở http://127.0.0.1:4317.

## Cấu hình (không bắt buộc)

Mặc định không cần cấu hình gì. Muốn đổi thì chép file mẫu rồi bỏ comment dòng cần dùng:

```bash
cp .env.example .env.local
```

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `CLAUDE_PROJECTS_DIR` | `~/.claude/projects` | Thư mục transcript của Claude Code |
| `FACTORY_WINDOW_HOURS` | `3` | Chỉ hiện phiên có hoạt động trong N giờ qua |
| `FACTORY_DATA_DIR` | `./.data` | Nơi lưu nhiệm vụ tạo trong Mission Control |

Sửa `.env.local` xong thì khởi động lại server.

## Các lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy bản phát triển, tự tải lại khi sửa code |
| `npm run build` / `npm start` | Build và chạy bản production |
| `npm run typecheck` | Sinh kiểu cho route rồi kiểm tra TypeScript |
| `npm run lint` | ESLint |
| `npm run icons` | Vẽ lại favicon, apple icon và icon PWA từ hình pixel trong `scripts/generate-icons.mjs` |

## Xử lý sự cố

**Khung vàng “Chưa thấy thư mục transcript của Claude Code”**
Máy này chưa từng chạy Claude Code, hoặc transcript nằm chỗ khác. Chạy Claude Code một lần, hoặc đặt
`CLAUDE_PROJECTS_DIR` trong `.env.local`. Trên Windows, đường dẫn mặc định là `%USERPROFILE%\.claude\projects`.

**Bản đồ trống dù đang dùng Claude Code**
- Chỉ phiên có hoạt động trong `FACTORY_WINDOW_HOURS` giờ gần nhất mới hiện.
- Phiên chạy bằng SDK đã xong bị ẩn mặc định; bấm “Hiện N phiên SDK đã xong” ở góc trên.

**Port 4317 đã có chương trình khác dùng**
Chạy ở port khác:

```bash
npx next dev -H 127.0.0.1 -p 4400
```

**`npm ci` báo lỗi phiên bản Node (`EBADENGINE`) hoặc build lỗi cú pháp lạ**
Node quá cũ. Cài Node 20.9 trở lên (`nvm install` sẽ đọc `.nvmrc`).

**`npm run typecheck` báo thiếu `RouteContext` / `LayoutProps`**
Các kiểu này do Next.js sinh ra. Hãy chạy qua `npm run typecheck`, vì lệnh này sinh kiểu trước; đừng gọi `tsc` trực tiếp.

**Muốn xem từ máy khác trong mạng LAN**
Server cố ý chỉ nghe `127.0.0.1`: transcript chứa code, prompt và đường dẫn trên máy bạn. Đừng mở ra mạng ngoài.
Nếu thật sự cần, hãy dùng SSH tunnel:

```bash
ssh -L 4317:127.0.0.1:4317 <máy-chạy-xưởng>
```

Rồi mở http://127.0.0.1:4317 trên máy của bạn.

**Trang báo `Forbidden host` (403)**
Xưởng chỉ trả lời khi địa chỉ trên thanh URL là `127.0.0.1`, `localhost` hoặc `[::1]`. Mở bằng IP mạng LAN hay
tên miền khác sẽ bị chặn (xem mục bên dưới). Hãy dùng một trong ba địa chỉ trên, hoặc SSH tunnel như ở trên.

## Dữ liệu và quyền riêng tư

- Server chỉ **đọc** `~/.claude/projects/**/*.jsonl`, và chỉ đọc phần mới ghi thêm mỗi lần.
- Server chỉ nghe `127.0.0.1` và từ chối mọi request có Host khác `127.0.0.1` / `localhost` / `[::1]`. Nhờ vậy một
  trang web lạ không thể dùng DNS rebinding để đọc dữ liệu xưởng qua trình duyệt của bạn.
- Quyền của agent đọc từ `settings.json`. Với MCP server chỉ lấy tên; lệnh, biến môi trường và token không bao giờ rời server.
- Nhiệm vụ tự tạo nằm trong `.data/missions.json` (đã git-ignore). Xưởng không tự chạy agent: “Chép lệnh” chỉ chép
  lệnh `claude` để bạn tự dán vào terminal.
- Chi phí hiển thị là **ước tính theo giá API công khai**. Dùng Claude Code bằng gói đăng ký thì không bị tính tiền theo token.

## Tìm hiểu thêm

[docs/architecture.md](docs/architecture.md) giải thích các trang, nguồn của từng chỉ số, 8 khu nhà máy, cách agent
tìm đường và cấu trúc thư mục.

Cách nhân vật di chuyển học theo [pixel-agents](https://github.com/pixel-agents-hq/pixel-agents) (MIT); code được viết lại từ đầu.

## Giấy phép

[MIT](LICENSE).
