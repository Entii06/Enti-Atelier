# ENTI Atelier

**Tập trung từng phút, ghi nhớ mỗi ngày.**

ENTI Atelier là không gian học tập kết hợp đồng hồ Pomodoro, học từ vựng tiếng Anh và hội họa lấy cảm hứng từ Vincent van Gogh. Trang web giúp bạn chia nhỏ thời gian học, ôn từ theo khả năng ghi nhớ và theo dõi hành trình tiến bộ trong một không gian mang màu sắc nghệ thuật.

Không cần tạo tài khoản. Dữ liệu học tập được lưu trên trình duyệt của bạn.

[Ủng hộ ENTI Atelier](#ủng-hộ-dự-án)

## Tính năng

### Tập trung với Pomodoro

- Các chế độ tập trung, nghỉ ngắn và nghỉ dài.
- Tùy chỉnh thời lượng và số phiên trước khi nghỉ dài.
- Ghi lại mục tiêu cho phiên học và xem lịch sử tập trung.
- Âm báo và thông báo trình duyệt khi được cấp quyền.
- Âm thanh nền, hỗ trợ thêm nguồn YouTube hoặc liên kết MP3.

### Học từ vựng tiếng Anh

- Tạo và chỉnh sửa thẻ từ với nghĩa, phiên âm, loại từ, ví dụ và ghi chú.
- Thêm từng từ, nhập nhanh nhiều từ hoặc nhập danh sách bằng JSON.
- Tra từ và nghe phát âm Anh–Anh, Anh–Mỹ.
- Tìm kiếm, lọc và sắp xếp kho từ vựng cá nhân.

### Ôn tập theo trí nhớ

- Lên lịch bằng **FSRS-6** thông qua thư viện `ts-fsrs`.
- Bốn mức đánh giá: **Quên**, **Khó nhớ**, **Nhớ được**, **Rất dễ**.
- Xem trước khoảng thời gian ôn tiếp theo ngay dưới các nút đánh giá.
- Học bằng flashcard hoặc luyện gõ đáp án; flashcard hỗ trợ đổi chiều Anh–Việt và Việt–Anh.
- Tự cập nhật danh sách thẻ đến hạn khi trang đang mở hoặc khi quay lại tab.
- Luyện trước các thẻ chưa đến hạn mà không thay đổi lịch ôn.

### Hội họa và hành trình học tập

- Bộ sưu tập tranh theo 12 tháng và hỗ trợ thêm ảnh cá nhân.
- Ghép tranh gắn với hoạt động điểm danh hằng ngày.
- Theo dõi thời gian tập trung, lượt ôn và phân bố mức độ trưởng thành của thẻ.
- Xem dự báo số thẻ cần ôn trong những ngày tiếp theo.
- Chuyển giao diện sáng/tối và tùy chỉnh không gian học.

## Công nghệ

| Thành phần | Công nghệ |
| --- | --- |
| Giao diện | React 19, TypeScript, Vite |
| Định dạng giao diện | Tailwind CSS, Lucide React, Motion |
| Lặp lại ngắt quãng | FSRS-6 qua `ts-fsrs` |
| API | Express; Vercel Functions khi deploy |
| Lưu dữ liệu cá nhân | IndexedDB, localStorage dự phòng |
| Hosting | Cấu hình sẵn cho Vercel |

## Chạy trên máy

### Yêu cầu

- Node.js **24.x** và npm.
- Kết nối Internet cho tra từ, phát âm trực tuyến và nội dung bên ngoài.

### Cài đặt và khởi chạy

Mở terminal trong thư mục dự án:

```sh
npm ci
npm run dev
```

Truy cập **http://localhost:3000**.

Các tính năng hiện tại không yêu cầu Gemini API key hay cơ sở dữ liệu máy chủ.

### Các lệnh thường dùng

| Lệnh | Chức năng |
| --- | --- |
| `npm run dev` | Chạy máy chủ phát triển cùng giao diện Vite |
| `npm run lint` | Kiểm tra kiểu dữ liệu TypeScript |
| `npm test` | Chạy các kiểm thử |
| `npm run build` | Kiểm tra ảnh và tạo bản production trong `dist/` |
| `npm start` | Chạy máy chủ Express ở chế độ production |

Để chạy bản production trên máy:

```sh
npm run build
npm start
```

Máy chủ mặc định dùng cổng `3000`; có thể đổi bằng biến môi trường `PORT`.

## Deploy lên Vercel

### Qua GitHub

1. Đẩy mã nguồn lên repository GitHub của bạn.
2. Trên Vercel, tạo project và import repository.
3. Dùng các thiết lập đã khai báo trong `vercel.json`:

   | Thiết lập | Giá trị |
   | --- | --- |
   | Framework | Vite |
   | Node.js | 24.x |
   | Install Command | `npm ci` |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |

4. Deploy project và sử dụng địa chỉ production cố định.

### Qua Vercel CLI

```sh
npx vercel login
npx vercel --prod
```

Giao diện được phục vụ từ `dist/`. Các API tra từ, phát âm và cấu hình bộ tranh nằm trong `api/` và chạy bằng Vercel Functions. Chỉ tải riêng thư mục `dist/` lên hosting tĩnh sẽ không cung cấp đầy đủ các API này.

Trên production, API chỉnh sửa bộ tranh mặc định bị khóa. Ảnh cá nhân của người dùng được lưu trên trình duyệt.

## Dữ liệu và quyền riêng tư

ENTI Atelier không có tài khoản đăng nhập trong website. Dữ liệu được tách theo **hồ sơ trình duyệt và tên miền**, gồm:

- Kho từ vựng và tiến độ FSRS.
- Lịch sử ôn tập.
- Cài đặt và lịch sử Pomodoro.
- Tiến độ ghép tranh, ảnh tải lên và các tùy chỉnh cá nhân.

Ứng dụng sử dụng IndexedDB và chuyển dữ liệu localStorage cũ sang IndexedDB trên cùng tên miền. localStorage được giữ làm bản phục hồi cho dữ liệu cũ và dùng dự phòng khi IndexedDB không khả dụng.

**Dữ liệu không tự đồng bộ giữa các thiết bị**, kể cả khi đăng nhập cùng tài khoản Google trên Chrome. Localhost, địa chỉ preview và tên miền production có kho dữ liệu riêng. Xóa dữ liệu trang web trong trình duyệt cũng xóa tiến độ được lưu tại đó.

Tra từ, phát âm và phát nội dung trực tuyến cần gửi yêu cầu tới các dịch vụ bên ngoài. Ứng dụng không đồng bộ toàn bộ kho học tập lên máy chủ.

## Cách hoạt động của lịch ôn

FSRS-6 hiện sử dụng bộ tham số mặc định và mục tiêu ghi nhớ **90%**. Đây là mục tiêu của mô hình, không phải tỷ lệ nhớ được đảm bảo cho mọi người dùng.

Sau mỗi lần ôn, bạn tự đánh giá khả năng nhớ để hệ thống tính lịch tiếp theo. Các khoảng thời gian dưới bốn nút là bốn lựa chọn cho **một lần ôn kế tiếp**, không phải một chuỗi mốc cố định.

Với thẻ chuyển từ SM-2, ứng dụng giữ ngày đến hạn hiện tại và khởi tạo trạng thái FSRS ước lượng khi thẻ được ôn tiếp. Các lượt luyện trước được ghi riêng và không làm giãn lịch ôn.

## Cấu trúc dự án

```text
api/                 Các điểm vào API cho Vercel
public/              Ảnh và tài nguyên tĩnh
  assets/artworks/   Bộ ảnh nền
  default-artworks/  Manifest bộ tranh mặc định
scripts/             Kiểm tra tài nguyên trước khi build
server/              Bộ điều hợp API cho Vercel
src/
  components/        Các màn hình và thành phần giao diện
  constants/         Cấu hình tranh và giao diện
  hooks/             Theo dõi thẻ đến hạn, lưu lịch sử
  utils/             FSRS, lưu trữ, âm thanh và tiện ích
tests/               Kiểm thử lịch ôn, lưu trữ và API
server.ts            Máy chủ Express dùng chung
vercel.json          Cấu hình deploy Vercel
```

## Tùy chỉnh bộ tranh

Đặt ảnh trong `public/assets/artworks/`, sau đó cập nhật:

- `public/default-artworks/manifest.json`: danh sách và đường dẫn bộ tranh mặc định.
- `src/constants/themes.ts`: cấu hình tranh và ảnh dự phòng tương ứng.

Đường dẫn dùng trong web không có tiền tố `public`, ví dụ:

```json
{
  "imageSrc": "/assets/artworks/ten-anh.jpg"
}
```

Tên file phải khớp chính xác, bao gồm chữ hoa/chữ thường. Bước build sẽ kiểm tra các ảnh được khai báo trong manifest.

---

## Ủng hộ dự án

Nếu ENTI Atelier giúp những giờ học của bạn trở nên dễ chịu và hiệu quả hơn, bạn có thể gửi một khoản ủng hộ tùy tâm. Sự đóng góp của bạn sẽ giúp tôi có thêm động lực chăm chút giao diện, sửa lỗi và phát triển những tính năng hữu ích cho mọi người.

### Ủng hộ qua mã QR

Bạn có thể quét mã dưới đây bằng ứng dụng ngân hàng:

<p align="center">
  <img src="public/assets/donate/donate.png" alt="Mã QR ủng hộ ENTI Atelier qua MB Bank — HUYNH LE NHUT TIEN" width="360" />
</p>

| Thông tin | Nội dung |
| --- | --- |
| Ngân hàng | MB Bank — Ngân hàng Quân đội |
| Chủ tài khoản | HUYNH LE NHUT TIEN |
| Số tài khoản | `0351234567890` |
| Nội dung chuyển khoản gợi ý | `Ung ho ENTI Atelier` |

Việc ủng hộ hoàn toàn tự nguyện, không có mức đóng góp tối thiểu. Bạn có thể tiếp tục sử dụng dự án mà không cần ủng hộ.

### Lời cảm ơn

**Cảm ơn tất cả mọi người đã và đang ủng hộ ENTI Atelier.**

Mỗi khoản đóng góp, lời góp ý, lượt chia sẻ hay lần quay lại sử dụng đều có ý nghĩa với tôi. Nhờ sự đồng hành của mọi người, dự án có thêm cơ hội được hoàn thiện từng ngày.

Nếu chưa thể ủng hộ bằng tài chính, bạn vẫn có thể giúp dự án bằng cách:

- Chia sẻ ENTI Atelier với bạn bè đang cần một không gian học tập.
- Báo lỗi hoặc đề xuất tính năng qua GitHub Issues.
- Đóng góp mã nguồn hoặc dành một ngôi sao cho repository nếu thấy hữu ích.

Chúc bạn luôn tìm được cảm hứng, giữ được nhịp học của riêng mình và có những giờ tập trung thật trọn vẹn.

**ENTI — Cảm ơn vì đã đồng hành.**

---

© ENTI 2026. Các thư viện và tài nguyên bên thứ ba tuân theo giấy phép tương ứng của chúng.
