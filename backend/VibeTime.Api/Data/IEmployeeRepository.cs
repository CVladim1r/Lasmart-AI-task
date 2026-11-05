using VibeTime.Api.Models;

namespace VibeTime.Api.Data;

public interface IEmployeeRepository
{
    Task<IReadOnlyList<Employee>> ListAsync(CancellationToken cancellationToken);
    Task<Employee?> FindByEmailAsync(string email, CancellationToken cancellationToken);
    Task<Employee?> FindByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<string?> GetPasswordHashAsync(string email, CancellationToken cancellationToken);
    Task<Employee?> CreateAsync(CreateEmployeeRequest employee, string passwordHash, CancellationToken cancellationToken);
    Task<bool> UpdateAsync(Guid id, UpdateEmployeeRequest employee, string? passwordHash, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken);
}
