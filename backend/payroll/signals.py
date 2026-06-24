"""
payroll/signals.py — Task 2.1: Auto-recalculate payroll on save

Connects a post_save signal to EmployeePayroll so that any time
key salary fields change, the gross/net/total are recomputed automatically.
This prevents stale salary totals when basic_salary, HRA, or breakdowns are updated.
"""
from __future__ import annotations

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)

# Fields that trigger a recalculation when changed
_TRIGGER_FIELDS = {
    "basic_salary",
    "hra",
    "bonus_amount",
    "arrears_amount",
    "earnings_breakdown",
    "deductions_breakdown",
    "extra_earnings",
    "extra_deductions",
    "loss_of_pay_days",
    "overtime_amount",
    "reimbursement_amount",
}

# Guard flag — prevents infinite recursion when recalculate itself saves
_RECALCULATING = set()


@receiver(post_save, sender="payroll.EmployeePayroll")
def auto_recalculate_payroll(sender, instance, created, update_fields, **kwargs):
    """
    After a payroll record is saved, re-run recalculate_employee_payroll()
    if any trigger fields were updated, as long as the payroll is still
    in a mutable state (draft / in_review).
    """
    from .models import EmployeePayroll

    # Skip locked or approved payrolls — they must not be changed silently
    if instance.status in {EmployeePayroll.STATUS_LOCKED, EmployeePayroll.STATUS_APPROVED}:
        return

    # Skip if already recalculating this instance (recursion guard)
    if instance.pk in _RECALCULATING:
        return

    # Only trigger if update_fields is None (full save) or contains a trigger field
    if update_fields is not None:
        updated = set(update_fields)
        if not updated & _TRIGGER_FIELDS:
            return

    _RECALCULATING.add(instance.pk)
    try:
        from .services import recalculate_employee_payroll
        recalculate_employee_payroll(instance, save=True)
        logger.debug(
            "[payroll] Auto-recalculated payroll id=%s employee=%s month=%s/%s  net=%.2f",
            instance.pk,
            instance.employee_id,
            instance.month,
            instance.year,
            float(instance.net_salary or 0),
        )
    except Exception as exc:
        # Never raise — a signal failure must not break the original save
        logger.exception("[payroll] Auto-recalculate failed for payroll id=%s: %s", instance.pk, exc)
    finally:
        _RECALCULATING.discard(instance.pk)
