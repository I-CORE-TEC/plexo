from functools import lru_cache

from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import BasePermission
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from atlas_content.atlas import SOURCE, read_manifest, render


FRAME_POLICY = (
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; '
    "script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; "
    'base-uri \'none\'; form-action \'none\'">'
)


class IsActualSuperuser(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return (
            user.is_authenticated
            and user.is_active
            and user.is_superuser
            and getattr(request, "simulacion", None) is None
        )


@lru_cache(maxsize=1)
def atlas_document():
    html = render(SOURCE, read_manifest(SOURCE))
    if "<head>" not in html:
        raise ValueError("Atlas document must have a head for its frame policy")
    return html.replace("<head>", "<head>" + FRAME_POLICY, 1)


@extend_schema(exclude=True)
@method_decorator(never_cache, name="dispatch")
class AtlasView(APIView):
    permission_classes = [IsActualSuperuser]
    renderer_classes = [JSONRenderer]

    def get(self, request):
        return Response({"html": atlas_document()})