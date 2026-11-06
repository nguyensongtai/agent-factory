# Tính năng và kiến trúc

Hướng dẫn cài đặt và chạy: xem [README](../README.md).

## Trang

| Trang | Nội dung |
|---|---|
| `/` Tổng quan | 6 KPI, biểu đồ 60 phút (lượt tool / token / chi phí / lỗi), bản đồ làng ninja, luồng hoạt động |
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

Nhiệm vụ tự tạo được lưu trong `.data/missions.json` (đã git-ignore). Làng **chỉ quan sát**, không tự chạy agent:
khi giao việc, bấm “Chép lệnh” rồi dán vào terminal (`claude --resume <id> '<việc>'`). Sau đó tự đánh dấu Xong hoặc
Hỏng, vì làng không thấy được tiến độ của việc tự tạo.

| Biến môi trường | Mặc định | Ý nghĩa |
|---|---|---|
| `CLAUDE_PROJECTS_DIR` | `~/.claude/projects` | Thư mục transcript |
| `FACTORY_WINDOW_HOURS` | `3` | Phiên có hoạt động trong N giờ qua mới hiện |
| `FACTORY_DATA_DIR` | `./.data` | Nơi lưu nhiệm vụ tự tạo |

API ghi (`/api/missions`) chỉ nhận JSON từ cùng origin: trang lạ mở trong trình duyệt không gửi lệnh vào được.

## Làng Ninja AI: 8 khu

Bản đồ là một làng ninja ẩn trong rừng núi về đêm: phía trên là phông núi đá nhiều lớp có sương, trăng và hai thác
nước; một dòng suối chảy từ thác xuống dọc con đường bên phải Command Tower, qua được bằng cầu gỗ; quanh làng là
rừng thông với đèn lồng đá. Mỗi khu là một ngôi nhà mái ngói có hiên gỗ và đèn lồng giấy, viền mái và biển tên neon
theo màu khu; Command Tower là ngôi chùa nhiều tầng mái. Trời mưa nhẹ. Ninja được vẽ to gấp đôi so với cảnh và có viền
sáng nhẹ để dễ nhìn. Tên khu và nhân vật đều tự thiết kế, không lấy từ truyện hay game nào.

| Khu | Công cụ | Trang trí |
|---|---|---|
| 📜 Scroll Archive · Thư khố | Read, Grep, Glob | Kệ gỗ cuộn giấy và hộp, đèn ổ đĩa |
| 💻 Coding Dojo | Edit, Write, Bash thường | Màn hình code trên tường, bàn thấp có máy |
| 🎯 Testing Arena | Bash chạy test / lint / typecheck / build | Sân cát, hình nộm rơm, bảng đèn kết quả |
| 🌘 Shadow Realm | WebFetch, WebSearch, Chrome, Browser | Sàn đá, ô cửa tròn nhìn ra trời đêm |
| 🕸️ Ninja Network | các MCP server khác | Tổng đài gỗ với dây nối nhiều màu |
| 🏯 Command Tower | đang suy nghĩ, Agent, SendMessage, Workflow, TodoWrite | Bệ đá, pha lê dữ liệu, hologram, **Mission Board** |
| ⛩️ Chakra Shrine | Skill, ToolSearch; ninja rảnh ngồi thiền ở đây | Chiếu tatami, đệm thiền, bonsai và ấm trà |
| ⚖️ Council Chamber | AskUserQuestion, ExitPlanMode | Cổng torii và chuông |

Mission Board treo trong Command Tower hiện số nhiệm vụ thật (đang chạy, chờ duyệt, đã xong); bấm vào để mở trang
Nhiệm vụ.

## Ninja và cấp bậc

Cấp bậc chỉ tính từ dữ liệu transcript (`domain/ranks.ts`), không tăng theo hoạt ảnh. Màu đai lưng của ninja là màu
cấp bậc:

| Cấp | Điều kiện |
|---|---|
| Genin | dưới 50 lượt tool trong phần transcript đã đọc |
| Chunin | 50–299 lượt tool |
| Jonin | từ 300 lượt tool |
| Sōke (trưởng môn) | có điều phối subagent trong phiên |

Hoạt ảnh theo trạng thái thật: rảnh thì ngồi thiền ở Chakra Shrine, làm việc thì ngồi bàn hoặc kết ấn, di chuyển thì
chạy với khăn bay, chờ duyệt thì giơ tay, xong lượt thì nhảy lên kèm ✓, tool lỗi thì run người, đổ mồ hôi kèm "!" đỏ.

Trạng thái phòng thay đổi theo hoạt động thật:
- Không có ai thì đèn lồng và biển neon tắt, khu chìm trong bóng tối.
- Có người thì đèn lồng neon sáng theo màu khu, toả sáng xuống sàn; ở các khu có bàn, ninja ngồi làm việc được màn
  hình hắt sáng lên mặt. Đường dữ liệu từ Command Tower tới khu chạy gói tin.
- Council Chamber đổi đèn lồng sang đỏ và nhấp nháy khi có ninja chờ bạn.
- Phòng chớp đỏ khi vừa có tool lỗi.

Bản đồ luôn hiện đủ 8 phòng, rộng hết trang Tổng quan; biểu đồ và luồng hoạt động nằm bên dưới.

Mỗi agent là một ninja pixel tự thiết kế (không dựa trên nhân vật có sẵn nào):
- **Gia tộc**: áo và khăn quàng theo màu của khu agent làm nhiều nhất; agent mới mặc màu Trung tâm điều phối.
  Subagent là ninja học việc nhỏ hơn, mặc màu gia tộc của agent đã gọi nó.
- **Ngoại hình** cố định theo phiên: mũ trùm, búi tóc + khăn che mặt, tóc đuôi ngựa hoặc nón lá; màu da và đai lưng.
- **Hoạt ảnh**: kết ấn khi làm việc, ngồi thiền lơ lửng khi suy nghĩ, ngồi thiền ở Trung tâm tài nguyên khi rảnh,
  giơ tay khi chờ duyệt, khăn bay theo khi di chuyển, nhảy lên kèm dấu ✓ khi xong lượt, “!” đỏ khi lỗi.
- **Khói**: một làn khói khi agent hoặc subagent xuất hiện, và khi subagent xong việc rời làng.

## Đường đi

Học theo cách [pixel-agents](https://github.com/pixel-agents-hq/pixel-agents) (MIT) di chuyển nhân vật, code tự viết lại:

- Làng là lưới ô 8px: hành lang (đi được), sàn phòng (đi được), tường sau và bệ lõi AI (chặn). Ra/vào phòng chỉ qua cửa ở tường dưới.
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

Mỗi frame vẽ theo lớp (`scene/render/frame.ts`):
1. Sàn tĩnh (`dojo.ts`): tường, sàn, đồ đạc, bàn, đệm, vẽ một lần ở 1 px logic mỗi khi đổi bố cục, rồi phóng to
   nguyên lần để giữ nét pixel.
   Địa hình (`terrain.ts`): phông núi, cỏ, đường mòn, rừng, suối và cầu.
2. Ánh sáng (`lighting.ts`): bản đồ sáng tính theo từng pixel, có dither để ra dải sáng kiểu pixel art, chỉ tính lại khi
   tập phòng sáng đèn hoặc bàn có người đổi; mỗi frame chỉ ghép lên bằng `multiply` và `lighter`.
3. Nhân vật (`agents.ts`), vẽ sau ánh sáng với màu đầy đủ để luôn nổi rõ trên nền tối.
4. Thứ phát sáng và thời tiết (`glow.ts`, `core.ts`, `floor.ts`, `weather.ts`): đèn lồng, màn hình, LED, đường dữ
   liệu, thác, gợn suối, mây, sương, mưa và hiệu ứng.
5. Chữ: biển tên, số agent, bong bóng, thẻ tên khi rê chuột.
