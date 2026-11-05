using Npgsql;
using NpgsqlTypes;
using VibeTime.Api.Models;

namespace VibeTime.Api.Data;

public sealed class EmployeeRepository(string connectionString) : IEmployeeRepository
{
    public async Task<IReadOnlyList<Employee>> ListAsync(CancellationToken cancellationToken)
    {
        const string sql = "SELECT id, last_name, first_name, middle_name, email, created_at FROM employees ORDER BY last_name, first_name, middle_name NULLS FIRST, id";
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var rows = new List<Employee>();
        while (await reader.ReadAsync(cancellationToken)) rows.Add(ReadEmployee(reader));
        return rows;
    }

    public async Task<Employee?> FindByEmailAsync(string email, CancellationToken cancellationToken)
    {
        const string sql = "SELECT id, last_name, first_name, middle_name, email, created_at FROM employees WHERE lower(email) = lower(@email)";
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("email", email.Trim());
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadEmployee(reader) : null;
    }

    public async Task<string?> GetPasswordHashAsync(string email, CancellationToken cancellationToken)
    {
        const string sql = "SELECT password_hash FROM employees WHERE lower(email) = lower(@email)";
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("email", email.Trim());
        return (string?)await command.ExecuteScalarAsync(cancellationToken);
    }

    public async Task<Employee?> FindByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        const string sql = "SELECT id, last_name, first_name, middle_name, email, created_at FROM employees WHERE id = @id";
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", id);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadEmployee(reader) : null;
    }

    public async Task<Employee?> CreateAsync(CreateEmployeeRequest employee, string passwordHash, CancellationToken cancellationToken)
    {
        const string sql = "INSERT INTO employees (last_name, first_name, middle_name, email, password_hash) VALUES (@last, @first, @middle, @email, @hash) RETURNING id, last_name, first_name, middle_name, email, created_at";
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        AddFields(command, employee.LastName!, employee.FirstName!, employee.MiddleName, employee.Email!);
        command.Parameters.AddWithValue("hash", passwordHash);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadEmployee(reader) : null;
    }

    public async Task<bool> UpdateAsync(Guid id, UpdateEmployeeRequest employee, string? passwordHash, CancellationToken cancellationToken)
    {
        const string sql = "UPDATE employees SET last_name=@last, first_name=@first, middle_name=@middle, email=@email, password_hash=COALESCE(@hash, password_hash), updated_at=now() WHERE id=@id";
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        AddFields(command, employee.LastName!, employee.FirstName!, employee.MiddleName, employee.Email!);
        command.Parameters.Add("hash", NpgsqlDbType.Text).Value = (object?)passwordHash ?? DBNull.Value;
        command.Parameters.AddWithValue("id", id);
        return await command.ExecuteNonQueryAsync(cancellationToken) == 1;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("DELETE FROM employees WHERE id=@id", connection);
        command.Parameters.AddWithValue("id", id);
        return await command.ExecuteNonQueryAsync(cancellationToken) == 1;
    }

    private static void AddFields(NpgsqlCommand command, string lastName, string firstName, string? middleName, string email)
    {
        command.Parameters.AddWithValue("last", lastName.Trim());
        command.Parameters.AddWithValue("first", firstName.Trim());
        command.Parameters.Add("middle", NpgsqlDbType.Text).Value = string.IsNullOrWhiteSpace(middleName) ? DBNull.Value : middleName.Trim();
        command.Parameters.AddWithValue("email", email.Trim());
    }

    private static Employee ReadEmployee(NpgsqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.IsDBNull(3) ? null : reader.GetString(3), reader.GetString(4), reader.GetFieldValue<DateTimeOffset>(5));
}
