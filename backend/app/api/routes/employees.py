"""Routes pour les employés et objectifs de vente"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.db.models import Employee, SalesGoal, User
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeResponse,
    SalesGoalCreate,
    SalesGoalUpdate,
    SalesGoalResponse
)
from app.core.security import get_current_active_user

router = APIRouter(tags=["employees"])


def check_company_access_employee(employee: Employee, user: User):
    """Vérifier que l'utilisateur a accès à cet employé"""
    if employee.company_id != user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this employee"
        )


# === EMPLOYEES ===

@router.get("/", response_model=List[EmployeeResponse])
async def get_employees(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer tous les employés de l'entreprise"""
    employees = db.query(Employee).filter(
        Employee.company_id == current_user.company_id,
        Employee.is_active == True
    ).offset(skip).limit(limit).all()

    return employees


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer un employé par ID"""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )

    check_company_access_employee(employee, current_user)
    return employee


@router.post("/", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    employee_data: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Créer un nouvel employé"""
    if employee_data.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create employee for another company"
        )

    new_employee = Employee(**employee_data.model_dump())
    db.add(new_employee)
    db.commit()
    db.refresh(new_employee)

    return new_employee


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: int,
    employee_data: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mettre à jour un employé"""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )

    check_company_access_employee(employee, current_user)

    update_data = employee_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(employee, field, value)

    db.commit()
    db.refresh(employee)

    return employee


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Supprimer un employé (soft delete)"""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )

    check_company_access_employee(employee, current_user)

    employee.is_active = False
    db.commit()

    return None


# === SALES GOALS ===

@router.get("/{employee_id}/goals", response_model=List[SalesGoalResponse])
async def get_employee_goals(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer tous les objectifs d'un employé"""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )

    check_company_access_employee(employee, current_user)

    goals = db.query(SalesGoal).filter(
        SalesGoal.employee_id == employee_id
    ).all()

    # Calculer le pourcentage de progression
    for goal in goals:
        if goal.target_amount > 0:
            goal.progress_percentage = (goal.current_amount / goal.target_amount) * 100
        else:
            goal.progress_percentage = 0

    return goals


@router.post("/{employee_id}/goals", response_model=SalesGoalResponse, status_code=status.HTTP_201_CREATED)
async def create_sales_goal(
    employee_id: int,
    goal_data: SalesGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Créer un nouvel objectif de vente pour un employé"""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )

    check_company_access_employee(employee, current_user)

    if goal_data.employee_id != employee_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee ID mismatch"
        )

    new_goal = SalesGoal(**goal_data.model_dump())
    db.add(new_goal)
    db.commit()
    db.refresh(new_goal)

    new_goal.progress_percentage = 0

    return new_goal


@router.put("/{employee_id}/goals/{goal_id}", response_model=SalesGoalResponse)
async def update_sales_goal(
    employee_id: int,
    goal_id: int,
    goal_data: SalesGoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mettre à jour un objectif de vente"""
    goal = db.query(SalesGoal).filter(
        SalesGoal.id == goal_id,
        SalesGoal.employee_id == employee_id
    ).first()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sales goal not found"
        )

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    check_company_access_employee(employee, current_user)

    update_data = goal_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(goal, field, value)

    db.commit()
    db.refresh(goal)

    if goal.target_amount > 0:
        goal.progress_percentage = (goal.current_amount / goal.target_amount) * 100
    else:
        goal.progress_percentage = 0

    return goal


@router.delete("/{employee_id}/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sales_goal(
    employee_id: int,
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Supprimer un objectif de vente"""
    goal = db.query(SalesGoal).filter(
        SalesGoal.id == goal_id,
        SalesGoal.employee_id == employee_id
    ).first()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sales goal not found"
        )

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    check_company_access_employee(employee, current_user)

    db.delete(goal)
    db.commit()

    return None
