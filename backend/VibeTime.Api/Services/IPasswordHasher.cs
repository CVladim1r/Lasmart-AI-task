namespace VibeTime.Api.Services;

/// I really dont now how, but i did it, but write in eng so so.. -> <summary>Implemented by the application host so the password format remains an explicit deployment choice.</summary>
public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string encodedHash);
}
