# まめコミポイントスキャナ

oboenikui が個人で開発した、まめコミポイント景品のシリアルコードをカメラで読み取り、クリップボードにコピーする非公式Webアプリケーションです。

## 技術スタック

- **フレームワーク**: React + TypeScript
- **ビルドツール**: Vite
- **画像処理**: OpenCV.js - カメラからのリアルタイム画像処理とシリアルコード認識
- **OCR**: Tesseract.js - 文字認識エンジン
- **デプロイ**: GitHub Pages - 静的サイトホスティング

## 主要機能

1. **カメラアクセス**: ユーザーのデバイスカメラにアクセス
2. **リアルタイム画像処理**: OpenCVを使用したシリアルコードの検出と読み取り
3. **クリップボード操作**: 読み取ったシリアルコードをクリップボードにコピー
4. **ユーザーフレンドリーなUI**: 直感的で使いやすいインターフェース
5. **カメラ切り替え**: 複数カメラ対応
6. **デバッグモード**: 開発者向けの詳細情報表示

## 開発環境

### 必要条件

- Node.js 18以上
- npm または yarn
- mkcert（HTTPS開発用）

### セットアップ

1. リポジトリをクローン
```bash
git clone https://github.com/oboenikui/mamecomi-point-scanner.git
cd mamecomi-point-scanner
```

2. 依存関係をインストール
```bash
npm install
```

3. HTTPS証明書のセットアップ（初回のみ）
```bash
# mkcertをインストール（macOS）
brew install mkcert

# ローカルCAをインストール
mkcert -install

# localhost用の証明書を生成
mkcert localhost 127.0.0.1 ::1
```

4. 開発サーバーを起動
```bash
npm run dev
```

5. ブラウザで `https://localhost:3000/mamecomi-point-scanner/` を開く

### ビルド

```bash
npm run build
```

### プレビュー

```bash
npm run preview
```

## 使用方法

1. ブラウザでカメラの許可を与える
2. 「スキャン開始」ボタンを押す
3. すこやかミルクのシリアルコードをカメラに映す
4. ガイド枠内にコードが収まると自動で読み取り開始
5. 読み取り完了後、「クリップボードにコピー」ボタンでコピー

## デバッグモード

URLパラメータに `?debug=true` を追加すると、デバッグ情報が表示されます。

例: `https://localhost:3000/mamecomi-point-scanner/?debug=true`

## アーキテクチャ

- **React**: UIコンポーネントと状態管理
- **TypeScript**: 型安全性の確保
- **OpenCV.js**: 画像処理とガイド検出
- **Tesseract.js**: OCR処理
- **Vite**: 高速な開発環境とビルド
