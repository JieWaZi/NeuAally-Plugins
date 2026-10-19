// Copyright (c) 2026 NeuxAlly contributors.
// 验证 macOS 的凭据及 DPoP 文件遵守插件私有数据目录，不触碰用户真实存储。
package keychain

import (
	"path/filepath"
	"testing"
)

func TestNeuxAllyPrivateStorage(t *testing.T) {
	directory := t.TempDir()
	t.Setenv("LARKSUITE_CLI_DATA_DIR", directory)
	resolved, err := filepath.EvalSymlinks(directory)
	if err != nil {
		t.Fatal(err)
	}
	if got := StorageDir("example-service"); got != filepath.Join(resolved, "example-service") {
		t.Fatalf("credential files escaped private directory: %s", got)
	}
}
