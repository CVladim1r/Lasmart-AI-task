using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VibeTime.Api.Models;
using VibeTime.Api.Services;

namespace VibeTime.Api.Controllers;

[ApiController]
[Route("api/employees")]
[Authorize]
public sealed class EmployeesController(EmployeeService employees) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken) => Ok(await employees.ListAsync(cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create(CreateEmployeeRequest request, CancellationToken cancellationToken)
    {
        var (employee, errors, duplicate) = await employees.CreateAsync(request, cancellationToken);
        if (duplicate) return Conflict(new { code = "email_in_use", errors });
        if (errors.Count > 0) return BadRequest(new ValidationProblemDetails(errors.ToDictionary(item => item.Key, item => item.Value)));
        return Created($"/api/employees/{employee!.Id}", employee);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateEmployeeRequest request, CancellationToken cancellationToken)
    {
        var (updated, errors, duplicate) = await employees.UpdateAsync(id, request, cancellationToken);
        if (duplicate) return Conflict(new { code = "email_in_use", errors });
        if (errors.Count > 0) return BadRequest(new ValidationProblemDetails(errors.ToDictionary(item => item.Key, item => item.Value)));
        return updated ? NoContent() : NotFound();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        await employees.DeleteAsync(id, cancellationToken) ? NoContent() : NotFound();
}
