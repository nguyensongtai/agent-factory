# Tính năng và kiến trúc

Hướng dẫn cài đặt và chạy: xem [README](../README.md).

## Trang

| Trang | Nội dung |
|---|---|
| `/` Tổng quan | 6 KPI, biểu đồ 60 phút (lượt tool / token / chi phí / lỗi), bản đồ nhà máy, luồng hoạt động |
| `/agents` | Bảng agent: vai trò, việc đang làm, model, trạng thái, token, tỉ lệ tool thành công, độ trễ. Bấm để mở drawer chi tiết |
| `/missions` | Mission Control: 6 cột Backlog → Thất bại, tạo và giao việc |
| `/monitoring` | Execution log dạng terminal, theo dõi lỗi, token theo phút và theo model, sức khoẻ server, hiệu suất từng agent |

Ở mọi trang, bấm vào agent sẽ mở drawer chi tiết gồm: kế hoạch, subagent, lịch sử thực thi, skill/MCP đã dùng,
quyền được cấp, token theo model và lệnh mở lại phiên. Bấm vào một phòng trên bản đồ để xem ai đang ở đó và việc gần
đây trong phòng.

## Dữ liệu: cái gì thật, cái gì ước tính

Mọi số liệu đều đọc từ transcript `~/.claude/projects/*/*.jsonl` và `<session>/subagents/*.jsonl`. Không có dữ liệu
giả và không gửi gì ra ngoài.

| Chỉ số | Nguồn |
|---|---|
| Token | `message.usage` của từng phản hồi API, mỗi message chỉ đếm một lần |
| Chi phí | **ước tính** theo bảng giá API công khai (`domain/pricing.ts`), gồm cả đọc/ghi cache. Dùng gói đăng ký thì không bị tính theo token |
| Phản hồi API | thời gian từ entry `api-request` tới khối trả lời đầu tiên có `requestRef` trùng khớp |
| Lỗi | `tool_result` có `is_error`, cùng các tin nhắn lỗi API |
| Nhiệm vụ | mỗi lượt yêu cầu của người dùng, mỗi lần chạy subagent, mỗi mục kế hoạch (TodoWrite / update_plan) |
| Quyền | `permissions.allow` trong `~/.claude/settings.json`, `.claude/settings*.json` của dự án, và **chỉ tên** MCP server trong `.mcp.json` / `~/.claude.json` |
| Sức khoẻ | thời gian quét và bộ nhớ của chính server này, cùng độ trễ cập nhật đo từ trình duyệt |

Transcript lớn hơn 8 MB chỉ được đọc từ đoạn cuối, nên tổng token của những phiên rất dài sẽ thấp hơn thực tế.

Nhiệm vụ tự tạo được lưu trong `.data/missions.json` (đã git-ignore). Xưởng **chỉ quan sát**, không tự chạy agent:
khi giao việc, bấm “Chép lệnh” rồi dán vào terminal (`claude --resume <id> '<việc>'`). Sau đó tự đánh dấu Xong hoặc
Hỏng, vì xưởng không thấy được tiến độ của việc tự tạo.

| Biến môi trường | Mặc định | Ý nghĩa |
|---|---|---|
| `CLAUDE_PROJECTS_DIR` | `~/.claude/projects` | Thư mục transcript |
| `FACTORY_WINDOW_HOURS` | `3` | Phiên có hoạt động trong N giờ qua mới hiện |
| `FACTORY_DATA_DIR` | `./.data` | Nơi lưu nhiệm vụ tự tạo |

API ghi (`/api/missions`) chỉ nhận JSON từ cùng origin: trang lạ mở trong trình duyệt không gửi lệnh vào được.

## 8 khu nhà máy

| Khu | Công cụ |
|---|---|
| 🗄️ Kho dữ liệu · Data Warehouse | Read, Grep, Glob |
| 🛠️ Phòng phát triển · Development Lab | Edit, Write, Bash thường |
| 🧪 Phòng kiểm thử · Testing Lab | Bash chạy test / lint / typecheck / build |
| 🌐 Trạm trình duyệt · Browser Station | WebFetch, WebSearch, Chrome, Browser |
| 🔌 Trung tâm MCP · MCP Hub | các MCP server khác |
| 🧠 Trung tâm điều phối · Orchestration Center | đang suy nghĩ, Agent, SendMessage, Workflow, TodoWrite |
| 🔋 Trung tâm tài nguyên · Resource Center | Skill, ToolSearch; agent rảnh ngồi sạc ở đây |
| 🛡️ Phòng phê duyệt · Approval Room | AskUserQuestion, ExitPlanMode |

Trạng thái phòng thay đổi theo hoạt động thật:
- Không có ai thì phòng tắt đèn.
- Có người làm thì đèn trần sáng, có vũng sáng trên sàn, và đường dữ liệu từ lõi tới phòng chạy gói tin.
- Phòng phê duyệt nhấp nháy khi có agent chờ bạn.
- Phòng chớp đỏ khi vừa có tool lỗi.

Agent giơ tay ăn mừng kèm dấu ✓ khi xong lượt, hiện “!” đỏ khi lỗi, và có vòng sáng khi mới vào xưởng.

## Đường đi

Học theo cách [pixel-agents](https://github.com/pixel-agents-hq/pixel-agents) (MIT) di chuyển nhân vật, code tự viết lại:

- Xưởng là lưới ô 8px: hành lang (đi được), sàn phòng (đi được), tường sau và bệ lõi AI (chặn). Ra/vào phòng chỉ qua cửa ở tường dưới.
- Tìm đường bằng BFS 4 hướng (`scene/grid.ts`); đi từng ô, quay mặt theo bước, đổi đích giữa chừng thì tính lại (`scene/movement.ts`).
- Tới khu thì ở lại tối thiểu 1,2 giây rồi mới đi tiếp, để không chạy loạn khi tool đổi liên tục.
- Agent rảnh thỉnh thoảng đứng dậy đi dạo trong Trung tâm tài nguyên rồi về chỗ.
- Chọn hoặc rê chuột lên một agent để xem đường đi còn lại (chấm xanh) và tooltip.
- Đường dữ liệu từ lõi tới cửa mỗi khu cũng tìm bằng BFS (`scene/traces.ts`), lệch làn 2px để không đè nhau.

## Cấu trúc

```
scripts/generate-icons.mjs        sinh mọi icon từ một hình pixel 16x16
src/app/                          chỉ chứa route
  (console)/                      layout dùng chung + 4 trang: /, /agents, /missions, /monitoring
  api/agents, api/missions        snapshot và kho nhiệm vụ tự tạo
src/components/ui/                UI dùng chung: Sheet (drawer/modal), Tooltip, StatCard, AreaChart, Segmented, States
src/features/factory/
  domain/      kiểu dữ liệu, khu, giá, chỉ số, nhiệm vụ, định dạng (thuần, dùng cho cả server lẫn client)
  server/      server-only: transcript.ts (parser tăng dần), tracker.ts (snapshot), permissions.ts, missions-store.ts
  context/     FactoryProvider: một lần poll cho mọi trang, trạng thái drawer agent/phòng
  hooks/       useFactorySnapshot, useManualMissions
  scene/       engine canvas, không phụ thuộc React: layout, grid, movement, entities, traces, render/*
  components/  shell, overview, map, agents, missions, monitoring, common
```

Sàn tĩnh (lưới, khung phòng, biển tên) được vẽ một lần vào canvas ẩn mỗi khi đổi bố cục hoặc kích thước. Mỗi frame chỉ
vẽ đèn, đồ động, đường dữ liệu, nhân vật và hiệu ứng.
