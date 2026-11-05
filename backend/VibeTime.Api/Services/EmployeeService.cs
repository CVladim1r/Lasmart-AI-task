using Npgsql;
using VibeTime.Api.Data;
using VibeTime.Api.Models;

namespace VibeTime.Api.Services;

public sealed class EmployeeService(IEmployeeRepository repository, IPasswordHasher passwordHasher)
{
    public Task<IReadOnlyList<Employee>> ListAsync(CancellationToken cancellationToken) => repository.ListAsync(cancellationToken);
    public Task<Employee?> FindByIdAsync(Guid id, CancellationToken cancellationToken) => repository.FindByIdAsync(id, cancellationToken);

    public async Task<(Employee? Employee, string? Error)> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email!.Trim();
        var employee = await repository.FindByEmailAsync(email, cancellationToken);
        if (employee is null) return (null, "email_not_found");
        var hash = await repository.GetPasswordHashAsync(email, cancellationToken);
        if (hash is null || !passwordHasher.Verify(request.Password!, hash)) return (null, "invalid_password");
        return (employee, null);
    }

    public async Task<(Employee? Employee, IReadOnlyDictionary<string, string[]> Errors, bool DuplicateEmail)> CreateAsync(CreateEmployeeRequest request, CancellationToken cancellationToken)
    {
        var errors = EmployeeValidation.Validate(request);
        if (errors.Count > 0) return (null, errors, false);
        try
        {
            var employee = await repository.CreateAsync(request, passwordHasher.Hash(request.Password!), cancellationToken);
            return (employee, errors, false);
        }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return (null, new Dictionary<string, string[]> { ["email"] = ["Этот email уже используется."] }, true);
        }
    }

    public async Task<(bool Updated, IReadOnlyDictionary<string, string[]> Errors, bool DuplicateEmail)> UpdateAsync(Guid id, UpdateEmployeeRequest request, CancellationToken cancellationToken)
    {
        var errors = EmployeeValidation.Validate(request);
        if (errors.Count > 0) return (false, errors, false);
        try
        {
            var hash = string.IsNullOrEmpty(request.Password) ? null : passwordHasher.Hash(request.Password);
            return (await repository.UpdateAsync(id, request, hash, cancellationToken), errors, false);
        }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return (false, new Dictionary<string, string[]> { ["email"] = ["Этот email уже используется."] }, true);
        }
    }

    public Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken) => repository.DeleteAsync(id, cancellationToken);
}
