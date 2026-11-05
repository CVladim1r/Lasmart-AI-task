using System.Net.Mail;
using VibeTime.Api.Models;

namespace VibeTime.Api.Services;

public static class EmployeeValidation
{
    public static IReadOnlyDictionary<string, string[]> Validate(CreateEmployeeRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        Required(errors, "lastName", request.LastName, 100);
        Required(errors, "firstName", request.FirstName, 100);
        Optional(errors, "middleName", request.MiddleName, 100);
        ValidateEmail(errors, request.Email);
        ValidatePassword(errors, request.Password, request.ConfirmPassword);
        return errors;
    }

    public static IReadOnlyDictionary<string, string[]> Validate(UpdateEmployeeRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        Required(errors, "lastName", request.LastName, 100);
        Required(errors, "firstName", request.FirstName, 100);
        Optional(errors, "middleName", request.MiddleName, 100);
        ValidateEmail(errors, request.Email);
        if (!string.IsNullOrEmpty(request.Password)) ValidatePassword(errors, request.Password, request.ConfirmPassword ?? string.Empty);
        else if (!string.IsNullOrEmpty(request.ConfirmPassword)) errors["confirmPassword"] = ["Подтверждение должно быть пустым, если пароль не меняется."];
        return errors;
    }

    private static void Required(Dictionary<string, string[]> errors, string field, string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value)) errors[field] = ["Поле обязательно."];
        else if (value.Trim().Length > maxLength) errors[field] = [$"Максимальная длина — {maxLength} символов."];
    }

    private static void Optional(Dictionary<string, string[]> errors, string field, string? value, int maxLength)
    {
        if (value?.Trim().Length > maxLength) errors[field] = [$"Максимальная длина — {maxLength} символов."];
    }

    private static void ValidateEmail(Dictionary<string, string[]> errors, string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) { errors["email"] = ["Email обязателен."]; return; }
        if (email.Trim().Length > 254 || !MailAddress.TryCreate(email.Trim(), out var parsed) || parsed.Address != email.Trim())
            errors["email"] = ["Введите корректный email."];
    }

    private static void ValidatePassword(Dictionary<string, string[]> errors, string? password, string? confirmation)
    {
        if (string.IsNullOrEmpty(password)) errors["password"] = ["Пароль обязателен."];
        else if (password.Length < 12) errors["password"] = ["Пароль должен содержать не менее 12 символов."];
        else if (password.Length > 1024) errors["password"] = ["Пароль слишком длинный."];
        if (password != confirmation) errors["confirmPassword"] = ["Пароли не совпадают."];
    }
}
