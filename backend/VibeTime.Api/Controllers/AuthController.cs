using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VibeTime.Api.Models;
using VibeTime.Api.Services;

namespace VibeTime.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(EmployeeService employees) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrEmpty(request.Password) || request.Password.Length > 1024)
            return BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]> { [string.IsNullOrWhiteSpace(request.Email) ? "email" : "password"] = ["Введите корректные email и пароль."] }));

        var (employee, error) = await employees.LoginAsync(request, cancellationToken);
        if (error == "email_not_found") return NotFound(new { code = error, message = "Сотрудник с таким email не найден." });
        if (error is not null) return Unauthorized(new { code = error, message = "Неверный пароль." });

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, employee!.Id.ToString()),
            new Claim(ClaimTypes.Name, string.Join(" ", new[] { employee.LastName, employee.FirstName, employee.MiddleName }.Where(part => !string.IsNullOrWhiteSpace(part)))),
            new Claim(ClaimTypes.Email, employee.Email)
        };
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)));
        return Ok(new { id = employee.Id, email = employee.Email, fullName = string.Join(" ", new[] { employee.LastName, employee.FirstName, employee.MiddleName }.Where(part => !string.IsNullOrWhiteSpace(part))) });
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    [HttpGet("session")]
    [Authorize]
    public async Task<IActionResult> Session(CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)) return Unauthorized();
        var employee = await employees.FindByIdAsync(id, cancellationToken);
        if (employee is null)
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Unauthorized();
        }
        var fullName = string.Join(" ", new[] { employee.LastName, employee.FirstName, employee.MiddleName }.Where(part => !string.IsNullOrWhiteSpace(part)));
        return Ok(new { id = employee.Id, email = employee.Email, fullName });
    }
}
