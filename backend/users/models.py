from django.db import models

# Create your models here.
import uuid
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _

class Tenant(models.Model):
    """
    Represents the 'Company' or 'Client' using the POS system.
    This is the root of the multi-tenancy architecture.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150, unique=True, help_text=_("Company Name"))
    subdomain = models.CharField(max_length=100, unique=True, db_index=True, help_text=_("Unique subdomain for tenant identification (e.g., 'companyx'.pos.com)"))
    
    # Enterprise: Store tenant-specific configs (Logo URL, Primary Color, Tax ID, Subscription Plan)
    config = models.JSONField(default=dict, blank=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tenants'
        verbose_name = 'Tenant'
        verbose_name_plural = 'Tenants'

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    """
    Custom manager to handle user creation with Tenant requirements.
    """
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError(_('The Email field must be set'))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        
        # Superusers (Platform Admins) might not belong to a tenant initially
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    """
    Custom User model supporting Multi-tenancy and Role-Based Access Control.
    """
    class Roles(models.TextChoices):
        TENANT_ADMIN = 'Tenant_Admin', _('Tenant Admin') # Oversees all branches
        BRANCH_MANAGER = 'Branch_Manager', _('Branch Manager')
        CASHIER = 'Cashier', _('Cashier')

    username = None  # We use email as the identifier
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(_('email address'), unique=True, db_index=True)

    # --- Multi-Tenancy Link ---
    # Nullable ONLY for Platform Superusers (Devs/Support). 
    # Real users MUST have a tenant.
    tenant = models.ForeignKey(
        Tenant, 
        on_delete=models.PROTECT, 
        related_name='users', 
        null=True, 
        blank=True
    )

    # --- Role & Scoping ---
    role = models.CharField(max_length=20, choices=Roles.choices, default=Roles.CASHIER)

    custom_permissions = models.JSONField(default=list, blank=True)
   
    # If Null, and role is Tenant_Admin -> Has access to ALL branches.
    # If Set, user is locked to this specific branch.
    branch = models.ForeignKey(
        'common.Branch', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='staff'
    )

    # Enterprise: Phone for 2FA or SMS notifications
    phone = models.CharField(max_length=20, null=True, blank=True)
    
    # Metadata for user preferences (UI theme, Language, default printer)
    settings = models.JSONField(default=dict, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['tenant', 'email']), # Optimize login lookups
            models.Index(fields=['tenant', 'role']),  # Optimize staff filtering
        ]

    def __str__(self):
        return f"{self.email} ({self.get_role_display()})"

    @property
    def is_tenant_admin(self):
        return self.role == self.Roles.TENANT_ADMIN

    def get_accessible_branches(self):
        """
        Helper to return a QuerySet of branches this user can access.
        """
        from common.models import Branch  # Avoid circular import
        if self.is_tenant_admin:
            return Branch.objects.filter(tenant=self.tenant)
        if self.branch:
            return Branch.objects.filter(id=self.branch.id)
        return Branch.objects.none()