package config

import (
	"github.com/cli/cli/v2/internal/config/migration"
	privatekeyring "github.com/cli/cli/v2/internal/keyring"
	"os"
	"path/filepath"
	"testing"

	systemkeyring "github.com/zalando/go-keyring"
)

// 验证官方真实登录编排在应用内执行时，不读写外部 gh 的活跃和同名用户凭据。
// newTestAuthConfig 使用上游内存钥匙串替身，不访问测试机器的真实系统存储。
func TestNeuxAllyLoginKeepsExternalKeyringUntouched(t *testing.T) {
	auth := newTestAuthConfig(t)
	for user, token := range map[string]string{"": "external-active", "same-user": "external-user"} {
		if err := systemkeyring.Set("gh:github.com", user, token); err != nil {
			t.Fatal(err)
		}
	}
	insecure, err := auth.Login("github.com", "same-user", "managed-token", "https", false)
	if err != nil || !insecure {
		t.Fatalf("managed login failed: insecure=%v error=%v", insecure, err)
	}
	for user, wanted := range map[string]string{"": "external-active", "same-user": "external-user"} {
		got, err := systemkeyring.Get("gh:github.com", user)
		if err != nil || got != wanted {
			t.Fatalf("external keyring changed for user %q: got=%q error=%v", user, got, err)
		}
	}
	token, source := auth.ActiveToken("github.com")
	if token != "managed-token" || source != "oauth_token" {
		t.Fatalf("private login not authoritative: token=%q source=%s", token, source)
	}
}

// 底层Set/Get/Delete都必须隔离当前profile，也不能命中旧应用或用户命名空间。
func TestNeuxAllyKeyringProfilesDoNotShareReadWriteOrDelete(t *testing.T) {
	newTestAuthConfig(t)
	first, second := t.TempDir(), t.TempDir()
	service, user := "gh:github.com", "same-user"
	for _, namespace := range []string{service, "neuxally:" + service} {
		if err := systemkeyring.Set(namespace, user, "outside-token"); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("GH_CONFIG_DIR", first)
	if token, err := privatekeyring.Get(service, user); err == nil || token != "" {
		t.Fatal("legacy credential inherited")
	}
	if err := privatekeyring.Set(service, user, "first-token"); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GH_CONFIG_DIR", second)
	if token, err := privatekeyring.Get(service, user); err == nil || token != "" {
		t.Fatal("other profile credential inherited")
	}
	if err := privatekeyring.Set(service, user, "second-token"); err != nil {
		t.Fatal(err)
	}
	if err := privatekeyring.Delete(service, user); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GH_CONFIG_DIR", filepath.Join(first, "."))
	if token, err := privatekeyring.Get(service, user); err != nil || token != "first-token" {
		t.Fatal("other profile write/delete changed first profile")
	}
	for _, namespace := range []string{service, "neuxally:" + service} {
		if token, err := systemkeyring.Get(namespace, user); err != nil || token != "outside-token" {
			t.Fatal("external credential changed")
		}
	}
}

func TestNeuxAllyKeyringRequiresExistingAbsoluteProfile(t *testing.T) {
	newTestAuthConfig(t)
	for _, profile := range []string{"", "relative-profile", filepath.Join(t.TempDir(), "missing")} {
		t.Setenv("GH_CONFIG_DIR", profile)
		if err := privatekeyring.Set("gh:github.com", "u", "token"); err == nil {
			t.Fatal("invalid profile set accepted")
		}
		if _, err := privatekeyring.Get("gh:github.com", "u"); err == nil {
			t.Fatal("invalid profile get accepted")
		}
		if err := privatekeyring.Delete("gh:github.com", "u"); err == nil {
			t.Fatal("invalid profile delete accepted")
		}
	}
}

func TestNeuxAllyMigrationUsesSamePrivateKeyringBoundary(t *testing.T) {
	auth := newTestAuthConfig(t)
	profile := os.Getenv("GH_CONFIG_DIR")
	for _, namespace := range []string{"gh:github.com", "neuxally:gh:github.com"} {
		if err := systemkeyring.Set(namespace, "", "outside-active"); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := preMigrationLogin(auth, "github.com", "managed-user", "managed-token", "https", true); err != nil {
		t.Fatal(err)
	}
	configuration := cfg{auth.cfg}
	if err := configuration.Migrate(migration.MultiAccountDeprecated{}); err != nil {
		t.Fatal(err)
	}
	if token, err := privatekeyring.Get("gh:github.com", "managed-user"); err != nil || token != "managed-token" {
		t.Fatal("migration did not retain private keyring identity")
	}
	t.Setenv("GH_CONFIG_DIR", t.TempDir())
	if token, err := privatekeyring.Get("gh:github.com", "managed-user"); err == nil || token != "" {
		t.Fatal("migration wrote shared credential")
	}
	t.Setenv("GH_CONFIG_DIR", profile)
	if err := auth.Logout("github.com", "managed-user"); err != nil {
		t.Fatal(err)
	}
	for _, namespace := range []string{"gh:github.com", "neuxally:gh:github.com"} {
		if token, err := systemkeyring.Get(namespace, ""); err != nil || token != "outside-active" {
			t.Fatal("migration/logout changed external identity")
		}
	}
}
