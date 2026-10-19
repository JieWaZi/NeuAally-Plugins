// Copyright (c) 2026 NeuxAlly contributors.
// 本回归文件由构建脚本复制到固定上游包，仅测试私有命名空间，不访问用户钥匙串。
package keychain

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestNeuxAllyPrivateService(t *testing.T) {
	t.Setenv("LARKSUITE_CLI_CONFIG_DIR", "")
	if got := privateService("lark-cli"); got != "lark-cli" {
		t.Fatalf("unmanaged service changed: %s", got)
	}
	t.Setenv("LARKSUITE_CLI_CONFIG_DIR", filepath.Join(t.TempDir(), "profile"))
	first := privateService("lark-cli")
	if !strings.HasPrefix(first, "neuxally-lark-cli-") || len(first) != len("neuxally-lark-cli-")+64 {
		t.Fatalf("invalid namespace: %s", first)
	}
	if privateService("lark-cli") != first {
		t.Fatal("same profile must reuse credentials")
	}
	if privateService("lark-dpop") == first {
		t.Fatal("different credential services must remain distinct")
	}
	t.Setenv("LARKSUITE_CLI_CONFIG_DIR", filepath.Join(t.TempDir(), "profile"))
	if privateService("lark-cli") == first {
		t.Fatal("different plugins must not share credentials")
	}
}
