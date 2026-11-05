using System.Security.Cryptography;
using System.Text;

namespace VibeTime.Api.Services;

public sealed class BcryptSha256PasswordHasher : IPasswordHasher
{
    private const string Prefix = "bcrypt-sha256:v1:";
    private const int WorkFactor = 12;

    public string Hash(string password)
    {
        var prehash = Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(password)));
        return Prefix + BCrypt.Net.BCrypt.HashPassword(prehash, workFactor: WorkFactor);
    }

    public bool Verify(string password, string encodedHash)
    {
        if (!encodedHash.StartsWith(Prefix, StringComparison.Ordinal)) return false;
        var prehash = Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(password)));
        return BCrypt.Net.BCrypt.Verify(prehash, encodedHash[Prefix.Length..]);
    }
}
